CREATE TABLE public.announcement_project_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.member_announcements(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  dossier_id uuid REFERENCES public.dossier_register(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, project_id)
);
GRANT SELECT ON public.announcement_project_links TO authenticated;
GRANT ALL ON public.announcement_project_links TO service_role;
ALTER TABLE public.announcement_project_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read announcement project links" ON public.announcement_project_links
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.announcement_name_matches(_text text, _name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT length(btrim(_name)) >= 4
     AND lower(_text) ~ ('(^|[^[:alnum:]])' || regexp_replace(lower(btrim(_name)), '([\\.\\^\\$\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|\\-])', '\\\1', 'g') || '($|[^[:alnum:]])')
$$;

CREATE OR REPLACE FUNCTION public.announcement_sync_projects(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; txt text; d date; n integer := 0; r record;
BEGIN
  SELECT * INTO a FROM public.member_announcements WHERE id = p_id;
  IF a IS NULL OR NOT a.published THEN RETURN 0; END IF;
  txt := a.title || ' ' || a.body;
  d := (coalesce(a.published_at, now()) AT TIME ZONE 'Europe/Amsterdam')::date;

  CREATE TEMP TABLE IF NOT EXISTS _ann_dossiers(id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _ann_targets(project_id uuid, dossier_id uuid) ON COMMIT DROP;
  DELETE FROM _ann_dossiers; DELETE FROM _ann_targets;

  INSERT INTO _ann_dossiers SELECT id FROM public.dossier_register
   WHERE archived_at IS NULL AND public.announcement_name_matches(txt, name);
  INSERT INTO _ann_targets SELECT p.id, NULL FROM public.internal_projects p
   WHERE p.archived_at IS NULL AND public.announcement_name_matches(txt, p.title);
  INSERT INTO _ann_targets SELECT l.project_id, l.dossier_id FROM public.dossier_project_links l
   JOIN _ann_dossiers x ON x.id = l.dossier_id
   JOIN public.internal_projects p ON p.id = l.project_id AND p.archived_at IS NULL;

  -- Ambiguous (too many matches): leave unlinked.
  IF (SELECT count(*) FROM _ann_dossiers) > 3 OR (SELECT count(DISTINCT project_id) FROM _ann_targets) > 3 THEN RETURN 0; END IF;

  UPDATE public.dossier_register SET status_summary = left(a.title, 500), status_date = d
   WHERE id IN (SELECT id FROM _ann_dossiers) AND (status_date IS NULL OR status_date <= d);

  FOR r IN SELECT project_id, max(dossier_id::text)::uuid AS dossier_id FROM _ann_targets GROUP BY project_id LOOP
    INSERT INTO public.announcement_project_links(announcement_id, project_id, dossier_id)
    VALUES (a.id, r.project_id, r.dossier_id) ON CONFLICT DO NOTHING;
    IF FOUND THEN
      INSERT INTO public.internal_project_messages(project_id, kind, body)
      VALUES (r.project_id, 'bericht', left('Aankondiging: ' || a.title || E'\n\n' || a.body, 20000));
      UPDATE public.internal_projects SET status_date = d
       WHERE id = r.project_id AND (status_date IS NULL OR status_date < d);
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.announcement_sync_projects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announcement_sync_projects(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.announcement_sync_projects_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.published THEN
    BEGIN
      PERFORM public.announcement_sync_projects(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'announcement project sync failed: %', SQLERRM; -- never block publishing
    END;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER zz_announcement_sync_projects
AFTER INSERT OR UPDATE OF published, title, body ON public.member_announcements
FOR EACH ROW EXECUTE FUNCTION public.announcement_sync_projects_trigger();