CREATE TABLE public.dossier_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_key text UNIQUE,
  parent_id uuid REFERENCES public.dossier_register(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  sort_order integer NOT NULL DEFAULT 0,
  jaarplan_kind text CHECK (jaarplan_kind IN ('hoofdstuk','thema')),
  jaarplan_section text,
  jaarplan_pages text,
  note text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX dossier_register_name_uq ON public.dossier_register (lower(btrim(name)));
COMMENT ON TABLE public.dossier_register IS 'Gedeelde dossierindeling (hoofddossier/subdossier) voor Projecten, Jaarplan en Financien.';

CREATE TABLE public.dossier_finance_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossier_register(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (label = btrim(label) AND length(label) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX dossier_finance_aliases_label_uq ON public.dossier_finance_aliases (lower(label));
COMMENT ON TABLE public.dossier_finance_aliases IS 'Exacte financiele dossierlabels per registerdossier; nooit fuzzy, boekingslabels zelf blijven ongewijzigd.';

CREATE TABLE public.dossier_project_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossier_register(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_origin text NOT NULL DEFAULT 'medewerker' CHECK (created_origin IN ('medewerker','bronimport')),
  UNIQUE (dossier_id, project_id)
);
CREATE INDEX dossier_project_links_project_idx ON public.dossier_project_links (project_id);

ALTER TABLE public.internal_projects ADD COLUMN IF NOT EXISTS import_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS internal_projects_import_ref_uq ON public.internal_projects (import_ref) WHERE import_ref IS NOT NULL;
COMMENT ON COLUMN public.internal_projects.import_ref IS 'Server-owned idempotente importsleutel; nooit door medewerkers te zetten.';

CREATE OR REPLACE FUNCTION public.internal_work_provenance()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
      NEW.created_origin := 'medewerker';
      NEW.import_ref := NULL;
    ELSE
      NEW.created_origin := 'bronimport';
    END IF;
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_origin := OLD.created_origin;
    NEW.import_ref := OLD.import_ref;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.dossier_register_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
  END IF;
  IF TG_TABLE_NAME = 'dossier_project_links' THEN
    NEW.created_origin := CASE WHEN auth.uid() IS NULL THEN 'bronimport' ELSE 'medewerker' END;
  END IF;
  IF TG_TABLE_NAME = 'dossier_register' AND NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.dossier_register WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Subdossiers mogen maar een niveau diep zijn';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE TRIGGER dossier_register_guard BEFORE INSERT OR UPDATE ON public.dossier_register FOR EACH ROW EXECUTE FUNCTION public.dossier_register_guard();
CREATE TRIGGER dossier_aliases_guard BEFORE INSERT OR UPDATE ON public.dossier_finance_aliases FOR EACH ROW EXECUTE FUNCTION public.dossier_register_guard();
CREATE TRIGGER dossier_links_guard BEFORE INSERT ON public.dossier_project_links FOR EACH ROW EXECUTE FUNCTION public.dossier_register_guard();

CREATE OR REPLACE FUNCTION public.dossier_link_log()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE dname text; r record; kind text;
BEGIN
  kind := CASE WHEN auth.uid() IS NOT NULL THEN 'medewerker' ELSE 'systeem' END;
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  SELECT name INTO dname FROM public.dossier_register WHERE id = r.dossier_id;
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.internal_projects WHERE id = OLD.project_id) THEN RETURN NULL; END IF;
    INSERT INTO public.internal_project_events(project_id, event_type, summary, actor_id, actor_kind)
    VALUES (OLD.project_id, 'dossier_ontkoppeld', 'Dossier ontkoppeld: ' || coalesce(dname, '?'), auth.uid(), kind);
  ELSE
    INSERT INTO public.internal_project_events(project_id, event_type, summary, actor_id, actor_kind)
    VALUES (NEW.project_id, 'dossier_gekoppeld', 'Dossier gekoppeld: ' || coalesce(dname, '?'), auth.uid(), kind);
  END IF;
  RETURN NULL;
END $function$;
CREATE TRIGGER dossier_link_log AFTER INSERT OR DELETE ON public.dossier_project_links FOR EACH ROW EXECUTE FUNCTION public.dossier_link_log();
REVOKE EXECUTE ON FUNCTION public.dossier_register_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dossier_link_log() FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.dossier_register TO authenticated;
GRANT SELECT ON public.dossier_finance_aliases TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.dossier_project_links TO authenticated;
GRANT ALL ON public.dossier_register, public.dossier_finance_aliases, public.dossier_project_links TO service_role;

ALTER TABLE public.dossier_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_finance_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_project_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins lezen dossierregister" ON public.dossier_register FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins lezen financiele aliases" ON public.dossier_finance_aliases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins lezen dossierkoppelingen" ON public.dossier_project_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins koppelen projecten" ON public.dossier_project_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins ontkoppelen projecten" ON public.dossier_project_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));