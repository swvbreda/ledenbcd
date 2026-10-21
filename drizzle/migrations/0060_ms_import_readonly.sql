-- Eenrichtingsimport Microsoft (BCD-agenda + Planner "To do") -> ledenbestand.
-- Additief: alleen admin-SELECT voor clients; schrijven uitsluitend via service-role RPC's met expliciete, actuele admin-actor.

ALTER TABLE public.agenda_events DROP CONSTRAINT IF EXISTS agenda_events_type_chk;
ALTER TABLE public.agenda_events ADD CONSTRAINT agenda_events_type_chk
  CHECK (event_type = ANY (ARRAY['bestuursvergadering'::text, 'evenement'::text, 'vergadering'::text]));

CREATE TABLE public.ms_import_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  release_gate boolean NOT NULL DEFAULT false,
  agenda_mailbox text NOT NULL DEFAULT 'simone@coffeeshopbond.nl' CHECK (agenda_mailbox = 'simone@coffeeshopbond.nl'),
  agenda_user_id text CHECK (agenda_user_id IS NULL OR agenda_user_id ~ '^[0-9a-f-]{36}$'),
  agenda_calendar_id text CHECK (agenda_calendar_id IS NULL OR (length(agenda_calendar_id) BETWEEN 1 AND 512 AND agenda_calendar_id ~ '^[A-Za-z0-9_=+/-]+$')),
  agenda_calendar_name text CHECK (agenda_calendar_name IS NULL OR length(agenda_calendar_name) <= 200),
  agenda_confirmed_by uuid,
  agenda_confirmed_at timestamptz,
  planner_mode text NOT NULL DEFAULT 'import' CHECK (planner_mode IN ('import', 'two_way')),
  planner_general_bucket_id text CHECK (planner_general_bucket_id IS NULL OR planner_general_bucket_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  planner_general_bucket_name text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ms_import_settings (id) VALUES (true);
GRANT SELECT ON public.ms_import_settings TO authenticated;
GRANT ALL ON public.ms_import_settings TO service_role;
ALTER TABLE public.ms_import_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lezen importinstellingen" ON public.ms_import_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ms_agenda_import_links (
  agenda_event_id uuid PRIMARY KEY REFERENCES public.agenda_events(id) ON DELETE RESTRICT,
  mailbox text NOT NULL,
  calendar_id text NOT NULL,
  event_id text NOT NULL,
  ical_uid text,
  series_master_id text,
  event_kind text,
  original_start text,
  teams_url text,
  last_modified timestamptz,
  remote_state text NOT NULL DEFAULT 'present' CHECK (remote_state IN ('present', 'cancelled', 'missing')),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mailbox, calendar_id, event_id)
);
GRANT SELECT ON public.ms_agenda_import_links TO authenticated;
GRANT ALL ON public.ms_agenda_import_links TO service_role;
ALTER TABLE public.ms_agenda_import_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lezen agenda-importkoppelingen" ON public.ms_agenda_import_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ms_planner_import_links (
  task_id uuid PRIMARY KEY REFERENCES public.internal_tasks(id) ON DELETE RESTRICT,
  plan_id text NOT NULL CHECK (plan_id = 'ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6'),
  planner_task_id text NOT NULL UNIQUE,
  bucket_id text NOT NULL,
  project_id uuid NOT NULL,
  remote_hash text,
  source_state text NOT NULL DEFAULT 'present' CHECK (source_state IN ('present', 'missing', 'moved')),
  warning text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ms_planner_import_links TO authenticated;
GRANT ALL ON public.ms_planner_import_links TO service_role;
ALTER TABLE public.ms_planner_import_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lezen Planner-importkoppelingen" ON public.ms_planner_import_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ms_planner_unprocessed (
  planner_task_id text PRIMARY KEY,
  plan_id text NOT NULL CHECK (plan_id = 'ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6'),
  bucket_id text NOT NULL,
  title text NOT NULL,
  due date,
  percent integer NOT NULL DEFAULT 0,
  assignee_count integer NOT NULL DEFAULT 0,
  source_state text NOT NULL DEFAULT 'present' CHECK (source_state IN ('present', 'missing', 'moved')),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ms_planner_unprocessed TO authenticated;
GRANT ALL ON public.ms_planner_unprocessed TO service_role;
ALTER TABLE public.ms_planner_unprocessed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lezen onverwerkte Planner-taken" ON public.ms_planner_unprocessed FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ms_import_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('agenda', 'planner')),
  external_key text NOT NULL,
  reason text NOT NULL,
  local_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (source, external_key, reason)
);
GRANT SELECT ON public.ms_import_conflicts TO authenticated;
GRANT ALL ON public.ms_import_conflicts TO service_role;
ALTER TABLE public.ms_import_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lezen importconflicten" ON public.ms_import_conflicts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ms_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('manual', 'scheduled')),
  actor uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb,
  error text
);
GRANT SELECT ON public.ms_import_runs TO authenticated;
GRANT ALL ON public.ms_import_runs TO service_role;
ALTER TABLE public.ms_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lezen importruns" ON public.ms_import_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Import mag geen taakmeldingen genereren (Microsoft is bron; geen notificaties).
CREATE OR REPLACE FUNCTION public.internal_task_assignment_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('bcd.ms_import', true) = 'on' THEN RETURN NULL; END IF;
  IF NEW.assignee_id IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN RETURN NULL; END IF;
  IF NEW.status = 'afgerond' THEN RETURN NULL; END IF;
  IF NEW.assignee_id = auth.uid() THEN RETURN NULL; END IF;
  IF NOT public.has_role(NEW.assignee_id, 'admin') THEN RETURN NULL; END IF;
  INSERT INTO public.task_notifications (recipient_id, task_id, event_key)
  VALUES (NEW.assignee_id, NEW.id, NEW.id::text || ':' || NEW.assignee_id::text || ':' || txid_current()::text)
  ON CONFLICT (event_key) DO NOTHING;
  RETURN NULL;
END $function$;

-- Beheer: alleen agenda-keuze/algemene bucket/schakelaar; release_gate en planner_mode niet via deze route.
CREATE OR REPLACE FUNCTION public.ms_import_configure(_actor uuid, _patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin') THEN RAISE EXCEPTION 'Alleen beheerders'; END IF;
  IF _patch ?| ARRAY['release_gate', 'planner_mode', 'agenda_mailbox', 'id'] THEN RAISE EXCEPTION 'Niet-toegestane instelling'; END IF;
  UPDATE public.ms_import_settings SET
    agenda_user_id = CASE WHEN _patch ? 'agenda_calendar_id' THEN _patch->>'agenda_user_id' ELSE agenda_user_id END,
    agenda_calendar_id = CASE WHEN _patch ? 'agenda_calendar_id' THEN _patch->>'agenda_calendar_id' ELSE agenda_calendar_id END,
    agenda_calendar_name = CASE WHEN _patch ? 'agenda_calendar_id' THEN _patch->>'agenda_calendar_name' ELSE agenda_calendar_name END,
    agenda_confirmed_by = CASE WHEN _patch ? 'agenda_calendar_id' THEN (CASE WHEN _patch->>'agenda_calendar_id' IS NULL THEN NULL ELSE _actor END) ELSE agenda_confirmed_by END,
    agenda_confirmed_at = CASE WHEN _patch ? 'agenda_calendar_id' THEN (CASE WHEN _patch->>'agenda_calendar_id' IS NULL THEN NULL ELSE now() END) ELSE agenda_confirmed_at END,
    planner_general_bucket_id = CASE WHEN _patch ? 'planner_general_bucket_id' THEN _patch->>'planner_general_bucket_id' ELSE planner_general_bucket_id END,
    planner_general_bucket_name = CASE WHEN _patch ? 'planner_general_bucket_id' THEN _patch->>'planner_general_bucket_name' ELSE planner_general_bucket_name END,
    enabled = CASE WHEN _patch ? 'enabled' THEN (_patch->>'enabled')::boolean ELSE enabled END,
    updated_by = _actor, updated_at = now()
  WHERE id;
END $$;

CREATE OR REPLACE FUNCTION public.ms_import_apply_agenda(_actor uuid, _calendar text, _items jsonb, _complete boolean, _from date, _to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s public.ms_import_settings%ROWTYPE; it jsonb; l public.ms_agenda_import_links%ROWTYPE; ev uuid; seen text[] := '{}';
  n_created int := 0; n_updated int := 0; n_cancelled int := 0; n_unchanged int := 0; n_conflicts int := 0; n_skipped int := 0; n_missing int := 0;
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
        IF FOUND THEN n_cancelled := n_cancelled + 1; ELSE n_unchanged := n_unchanged + 1; END IF;
      ELSE
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
  -- Afwezigheid alleen na volledig gelezen venster; lokaal item blijft ongewijzigd.
  IF _complete THEN
    UPDATE public.ms_agenda_import_links k SET remote_state = 'missing', updated_at = now()
    FROM public.agenda_events a
    WHERE a.id = k.agenda_event_id AND k.mailbox = s.agenda_mailbox AND k.calendar_id = _calendar
      AND k.remote_state = 'present' AND NOT (k.event_id = ANY (seen)) AND a.event_date BETWEEN _from AND _to;
    GET DIAGNOSTICS n_missing = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('created', n_created, 'updated', n_updated, 'cancelled', n_cancelled, 'unchanged', n_unchanged,
    'conflicts', n_conflicts, 'skipped', n_skipped, 'missing', n_missing);
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
      IF l.remote_hash IS NOT DISTINCT FROM it->>'hash' THEN
        UPDATE public.ms_planner_import_links SET last_seen_at = now(), source_state = 'present' WHERE task_id = l.task_id;
        n_unchanged := n_unchanged + 1; CONTINUE;
      END IF;
      UPDATE public.internal_tasks t SET title = left(it->>'title', 200), deadline = (it->>'due')::date, assignee_id = who,
        status = CASE WHEN pct >= 100 THEN 'afgerond' WHEN pct <= 0 THEN 'te_doen' WHEN t.status = 'wacht' THEN 'wacht' ELSE 'bezig' END
      WHERE t.id = l.task_id AND t.source_system IS NULL;
      UPDATE public.ms_planner_import_links SET remote_hash = it->>'hash', warning = warn, source_state = 'present', last_seen_at = now(), updated_at = now() WHERE task_id = l.task_id;
      n_updated := n_updated + 1;
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

REVOKE ALL ON FUNCTION public.ms_import_configure(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ms_import_apply_agenda(uuid, text, jsonb, boolean, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ms_import_apply_planner(uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ms_import_configure(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ms_import_apply_agenda(uuid, text, jsonb, boolean, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.ms_import_apply_planner(uuid, text, jsonb, boolean) TO service_role;
