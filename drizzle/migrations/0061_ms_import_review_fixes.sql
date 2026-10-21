-- Vastlegging rechten (door gebruiker goedgekeurd): anon niets, authenticated alleen SELECT onder admin-RLS, service_role volledig.
REVOKE ALL ON public.ms_import_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ms_import_settings TO authenticated;
GRANT ALL ON public.ms_import_settings TO service_role;
REVOKE ALL ON public.ms_agenda_import_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ms_agenda_import_links TO authenticated;
GRANT ALL ON public.ms_agenda_import_links TO service_role;
REVOKE ALL ON public.ms_planner_import_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ms_planner_import_links TO authenticated;
GRANT ALL ON public.ms_planner_import_links TO service_role;
REVOKE ALL ON public.ms_planner_unprocessed FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ms_planner_unprocessed TO authenticated;
GRANT ALL ON public.ms_planner_unprocessed TO service_role;
REVOKE ALL ON public.ms_import_conflicts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ms_import_conflicts TO authenticated;
GRANT ALL ON public.ms_import_conflicts TO service_role;
REVOKE ALL ON public.ms_import_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ms_import_runs TO authenticated;
GRANT ALL ON public.ms_import_runs TO service_role;

ALTER TABLE public.ms_agenda_import_links ADD COLUMN IF NOT EXISTS cancelled_by_import boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ms_import_apply_agenda(_actor uuid, _calendar text, _items jsonb, _complete boolean, _from date, _to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s public.ms_import_settings%ROWTYPE; it jsonb; l public.ms_agenda_import_links%ROWTYPE; ev uuid; seen text[] := '{}';
  n_created int := 0; n_updated int := 0; n_cancelled int := 0; n_unchanged int := 0; n_conflicts int := 0; n_skipped int := 0; n_missing int := 0; n_restored int := 0;
  canc boolean;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin') THEN RAISE EXCEPTION 'Alleen beheerders'; END IF;
  SELECT * INTO s FROM public.ms_import_settings WHERE id;
  IF s.agenda_calendar_id IS NULL OR s.agenda_calendar_id IS DISTINCT FROM _calendar THEN RAISE EXCEPTION 'BCD-agenda niet bevestigd'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ms_agenda:' || s.agenda_mailbox || ':' || _calendar));
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(_items, '[]'::jsonb)) LOOP
    seen := seen || (it->>'event_id');
    canc := coalesce((it->>'cancelled')::boolean, false);
    SELECT * INTO l FROM public.ms_agenda_import_links WHERE mailbox = s.agenda_mailbox AND calendar_id = _calendar AND event_id = it->>'event_id';
    IF FOUND THEN
      UPDATE public.ms_agenda_import_links SET last_seen_at = now(), updated_at = now(),
        remote_state = CASE WHEN canc THEN 'cancelled' ELSE 'present' END,
        teams_url = it->>'teams_url', last_modified = (it->>'last_modified')::timestamptz,
        ical_uid = it->>'ical_uid', series_master_id = it->>'series_master_id', event_kind = it->>'kind', original_start = it->>'original_start'
      WHERE agenda_event_id = l.agenda_event_id;
      IF canc THEN
        UPDATE public.agenda_events SET cancelled_at = now(), cancel_reason = 'Geannuleerd in Outlook'
          WHERE id = l.agenda_event_id AND cancelled_at IS NULL;
        IF FOUND THEN
          UPDATE public.ms_agenda_import_links SET cancelled_by_import = true WHERE agenda_event_id = l.agenda_event_id;
          n_cancelled := n_cancelled + 1;
        ELSE n_unchanged := n_unchanged + 1; END IF;
      ELSE
        -- Alleen een annulering die deze import zelf zette wordt teruggedraaid; lokale beheerdersannulering blijft.
        IF l.cancelled_by_import THEN
          UPDATE public.agenda_events SET cancelled_at = NULL, cancel_reason = NULL
            WHERE id = l.agenda_event_id AND cancelled_at IS NOT NULL AND cancel_reason = 'Geannuleerd in Outlook';
          IF FOUND THEN n_restored := n_restored + 1; END IF;
          UPDATE public.ms_agenda_import_links SET cancelled_by_import = false WHERE agenda_event_id = l.agenda_event_id;
        END IF;
        UPDATE public.agenda_events SET title = it->>'title', event_date = (it->>'date')::date,
          start_time = (it->>'start_time')::time, end_time = (it->>'end_time')::time, location = it->>'location'
        WHERE id = l.agenda_event_id
          AND ROW(title, event_date, start_time, end_time, location) IS DISTINCT FROM
              ROW(it->>'title', (it->>'date')::date, (it->>'start_time')::time, (it->>'end_time')::time, it->>'location');
        IF FOUND THEN n_updated := n_updated + 1; ELSE n_unchanged := n_unchanged + 1; END IF;
      END IF;
    ELSIF EXISTS (SELECT 1 FROM public.agenda_events a WHERE a.outlook_event_id = it->>'event_id' OR a.external_event_id = it->>'event_id') THEN
      INSERT INTO public.ms_import_conflicts (source, external_key, reason, local_id)
        SELECT 'agenda', it->>'event_id', 'bestaand_app_item', a.id FROM public.agenda_events a
        WHERE a.outlook_event_id = it->>'event_id' OR a.external_event_id = it->>'event_id' LIMIT 1
      ON CONFLICT DO NOTHING;
      n_conflicts := n_conflicts + 1;
    ELSIF canc THEN
      n_skipped := n_skipped + 1;
    ELSE
      INSERT INTO public.agenda_events (title, event_type, event_date, start_time, end_time, location, is_published, created_by)
        VALUES (it->>'title', 'vergadering', (it->>'date')::date, (it->>'start_time')::time, (it->>'end_time')::time, it->>'location', false, _actor)
        RETURNING id INTO ev;
      INSERT INTO public.ms_agenda_import_links (agenda_event_id, mailbox, calendar_id, event_id, ical_uid, series_master_id, event_kind, original_start, teams_url, last_modified, last_seen_at)
        VALUES (ev, s.agenda_mailbox, _calendar, it->>'event_id', it->>'ical_uid', it->>'series_master_id', it->>'kind', it->>'original_start', it->>'teams_url', (it->>'last_modified')::timestamptz, now());
      n_created := n_created + 1;
    END IF;
  END LOOP;
  IF _complete THEN
    UPDATE public.ms_agenda_import_links k SET remote_state = 'missing', updated_at = now()
    FROM public.agenda_events a
    WHERE a.id = k.agenda_event_id AND k.mailbox = s.agenda_mailbox AND k.calendar_id = _calendar
      AND k.remote_state = 'present' AND NOT (k.event_id = ANY (seen)) AND a.event_date BETWEEN _from AND _to;
    GET DIAGNOSTICS n_missing = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('created', n_created, 'updated', n_updated, 'cancelled', n_cancelled, 'unchanged', n_unchanged,
    'conflicts', n_conflicts, 'skipped', n_skipped, 'missing', n_missing, 'restored', n_restored);
END $$;

CREATE OR REPLACE FUNCTION public.ms_import_apply_planner(_actor uuid, _bucket text, _items jsonb, _complete boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s public.ms_import_settings%ROWTYPE; it jsonb; l public.ms_planner_import_links%ROWTYPE; proj uuid; tid uuid; seen text[] := '{}';
  ids text[]; mapped uuid[]; who uuid; warn text; pct int;
  n_created int := 0; n_updated int := 0; n_unchanged int := 0; n_conflicts int := 0; n_moved int := 0; n_unprocessed int := 0; n_missing int := 0; n_warn int := 0;
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin') THEN RAISE EXCEPTION 'Alleen beheerders'; END IF;
  SELECT * INTO s FROM public.ms_import_settings WHERE id;
  IF s.planner_mode <> 'import' THEN RAISE EXCEPTION 'Planner staat niet in leesmodus'; END IF;
  SELECT pl.project_id INTO proj FROM public.planner_project_links pl JOIN public.internal_projects p ON p.id = pl.project_id
    WHERE pl.plan_id = 'ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6' AND pl.bucket_id = _bucket AND p.archived_at IS NULL;
  IF proj IS NULL AND _bucket IS DISTINCT FROM s.planner_general_bucket_id THEN RAISE EXCEPTION 'Bucket niet expliciet gekoppeld'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ms_planner:ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6'));
  PERFORM set_config('bcd.ms_import', 'on', true);
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(_items, '[]'::jsonb)) LOOP
    seen := seen || (it->>'id');
    pct := coalesce((it->>'percent')::int, 0);
    IF EXISTS (SELECT 1 FROM public.planner_task_links WHERE planner_task_id = it->>'id') THEN
      INSERT INTO public.ms_import_conflicts (source, external_key, reason) VALUES ('planner', it->>'id', 'tweerichting_koppeling') ON CONFLICT DO NOTHING;
      n_conflicts := n_conflicts + 1; CONTINUE;
    END IF;
    ids := ARRAY(SELECT lower(x) FROM jsonb_array_elements_text(coalesce(it->'assignees', '[]'::jsonb)) x);
    mapped := ARRAY(SELECT m.user_id FROM public.planner_user_map m WHERE lower(m.entra_id) = ANY (ids) AND public.has_role(m.user_id, 'admin'));
    who := NULL; warn := NULL;
    IF cardinality(ids) = 1 AND cardinality(mapped) = 1 THEN who := mapped[1];
    ELSIF cardinality(ids) > 1 THEN warn := 'Meerdere personen in Planner; niet toegewezen';
    ELSIF cardinality(ids) = 1 THEN warn := 'Onbekende persoon in Planner; niet toegewezen';
    END IF;
    IF warn IS NOT NULL THEN n_warn := n_warn + 1; END IF;
    SELECT * INTO l FROM public.ms_planner_import_links WHERE planner_task_id = it->>'id';
    IF FOUND THEN
      IF l.bucket_id <> _bucket THEN
        UPDATE public.ms_planner_import_links SET source_state = 'moved', warning = 'Verplaatst naar andere bucket in Planner; lokaal behouden', updated_at = now() WHERE task_id = l.task_id;
        n_moved := n_moved + 1; CONTINUE;
      END IF;
      -- Microsoft leidend voor bewezen import-koppelingen: ook bij gelijke hash canonieke velden en (nieuw bevestigde) eigenaar herberekenen.
      UPDATE public.internal_tasks t SET title = left(it->>'title', 200), deadline = (it->>'due')::date, assignee_id = who,
        status = CASE WHEN pct >= 100 THEN 'afgerond' WHEN pct <= 0 THEN 'te_doen' WHEN t.status = 'wacht' THEN 'wacht' ELSE 'bezig' END
      WHERE t.id = l.task_id AND t.source_system IS NULL
        AND ROW(t.title, t.deadline, t.assignee_id, t.status) IS DISTINCT FROM ROW(left(it->>'title', 200), (it->>'due')::date, who,
          CASE WHEN pct >= 100 THEN 'afgerond' WHEN pct <= 0 THEN 'te_doen' WHEN t.status = 'wacht' THEN 'wacht' ELSE 'bezig' END);
      IF FOUND THEN n_updated := n_updated + 1; ELSE n_unchanged := n_unchanged + 1; END IF;
      UPDATE public.ms_planner_import_links SET remote_hash = it->>'hash', warning = warn, source_state = 'present', last_seen_at = now(), updated_at = now() WHERE task_id = l.task_id;
    ELSIF proj IS NULL THEN
      INSERT INTO public.ms_planner_unprocessed (planner_task_id, plan_id, bucket_id, title, due, percent, assignee_count, source_state, last_seen_at)
        VALUES (it->>'id', 'ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6', _bucket, left(it->>'title', 200), (it->>'due')::date, pct, cardinality(ids), 'present', now())
      ON CONFLICT (planner_task_id) DO UPDATE SET bucket_id = EXCLUDED.bucket_id, title = EXCLUDED.title, due = EXCLUDED.due, percent = EXCLUDED.percent,
        assignee_count = EXCLUDED.assignee_count, source_state = 'present', last_seen_at = now();
      n_unprocessed := n_unprocessed + 1;
    ELSE
      INSERT INTO public.internal_tasks (title, project_id, deadline, status, priority, assignee_id, created_by)
        VALUES (left(it->>'title', 200), proj, (it->>'due')::date,
          CASE WHEN pct >= 100 THEN 'afgerond' WHEN pct <= 0 THEN 'te_doen' ELSE 'bezig' END, 'normaal', who, _actor)
        RETURNING id INTO tid;
      INSERT INTO public.ms_planner_import_links (task_id, plan_id, planner_task_id, bucket_id, project_id, remote_hash, warning, last_seen_at)
        VALUES (tid, 'ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6', it->>'id', _bucket, proj, it->>'hash', warn, now());
      n_created := n_created + 1;
    END IF;
  END LOOP;
  IF _complete THEN
    UPDATE public.ms_planner_import_links SET source_state = 'missing', updated_at = now()
      WHERE bucket_id = _bucket AND source_state = 'present' AND NOT (planner_task_id = ANY (seen));
    GET DIAGNOSTICS n_missing = ROW_COUNT;
    UPDATE public.ms_planner_unprocessed SET source_state = 'missing'
      WHERE bucket_id = _bucket AND source_state = 'present' AND NOT (planner_task_id = ANY (seen));
  END IF;
  RETURN jsonb_build_object('created', n_created, 'updated', n_updated, 'unchanged', n_unchanged, 'conflicts', n_conflicts,
    'moved', n_moved, 'unprocessed', n_unprocessed, 'missing', n_missing, 'warnings', n_warn);
END $$;

REVOKE ALL ON FUNCTION public.ms_import_apply_agenda(uuid, text, jsonb, boolean, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ms_import_apply_planner(uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ms_import_apply_agenda(uuid, text, jsonb, boolean, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.ms_import_apply_planner(uuid, text, jsonb, boolean) TO service_role;
