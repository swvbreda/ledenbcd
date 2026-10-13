-- Server-owned herkomst voor projecten en taken; bestaande created_by blijft ongewijzigd.
ALTER TABLE public.internal_projects ADD COLUMN IF NOT EXISTS created_origin text CHECK (created_origin IS NULL OR created_origin IN ('medewerker','bronimport'));
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS created_origin text CHECK (created_origin IS NULL OR created_origin IN ('medewerker','bronimport'));
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS import_ref text CHECK (import_ref IS NULL OR length(btrim(import_ref)) BETWEEN 1 AND 500);
COMMENT ON COLUMN public.internal_projects.created_origin IS 'Server-owned: medewerker (auth.uid) of bronimport (service). NULL = historisch, niet vastgelegd.';
COMMENT ON COLUMN public.internal_tasks.created_origin IS 'Server-owned: medewerker (auth.uid) of bronimport (service). NULL = historisch, niet vastgelegd.';
COMMENT ON COLUMN public.internal_tasks.import_ref IS 'Server-owned idempotentiesleutel voor bronimport (bv. mail); alleen service mag zetten. Los van Topical source_ref.';
CREATE UNIQUE INDEX IF NOT EXISTS internal_tasks_import_ref_uq ON public.internal_tasks(import_ref) WHERE import_ref IS NOT NULL;

UPDATE public.internal_projects SET created_origin = 'bronimport' WHERE id = '50fbd787-f00c-4ab1-8129-58acca10c3c0';

CREATE OR REPLACE FUNCTION public.internal_work_provenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
      NEW.created_origin := 'medewerker';
      IF TG_TABLE_NAME = 'internal_tasks' THEN NEW.import_ref := NULL; END IF;
    ELSE
      NEW.created_origin := 'bronimport';
    END IF;
  ELSE
    NEW.created_origin := OLD.created_origin;
    IF TG_TABLE_NAME = 'internal_tasks' THEN NEW.import_ref := OLD.import_ref; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.internal_work_provenance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER internal_projects_provenance BEFORE INSERT OR UPDATE ON public.internal_projects FOR EACH ROW EXECUTE FUNCTION public.internal_work_provenance();
CREATE TRIGGER internal_tasks_provenance BEFORE INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.internal_work_provenance();

-- Geschiedenis: ook titel/omschrijving/prioriteit van taken; service-inserts als bronimport.
CREATE OR REPLACE FUNCTION public.internal_project_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; tid uuid; typ text; s text; kind text;
BEGIN
  kind := CASE WHEN auth.uid() IS NOT NULL THEN 'medewerker' ELSE 'systeem' END;
  IF TG_OP = 'INSERT' AND auth.uid() IS NULL AND TG_TABLE_NAME IN ('internal_projects','internal_tasks') THEN kind := 'bronimport'; END IF;
  IF TG_TABLE_NAME = 'internal_projects' THEN
    pid := NEW.id;
    IF TG_OP = 'INSERT' THEN typ := 'project_aangemaakt'; s := 'Project aangemaakt';
    ELSE
      s := concat_ws('; ',
        CASE WHEN NEW.title IS DISTINCT FROM OLD.title THEN 'titel gewijzigd' END,
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status ' || NEW.status END,
        CASE WHEN NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN 'verantwoordelijke gewijzigd' END,
        CASE WHEN NEW.due_date IS DISTINCT FROM OLD.due_date THEN 'einddatum gewijzigd' END,
        CASE WHEN NEW.description IS DISTINCT FROM OLD.description OR NEW.project_plan IS DISTINCT FROM OLD.project_plan THEN 'projectplan bijgewerkt' END,
        CASE WHEN (NEW.budget_estimate, NEW.budget_reserved, NEW.budget_received) IS DISTINCT FROM (OLD.budget_estimate, OLD.budget_reserved, OLD.budget_received) THEN 'budget bijgewerkt' END,
        CASE WHEN NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN CASE WHEN NEW.archived_at IS NULL THEN 'teruggezet' ELSE 'gearchiveerd' END END);
      IF s = '' THEN RETURN NULL; END IF;
      typ := 'project_gewijzigd'; s := 'Project: ' || s;
    END IF;
  ELSIF TG_TABLE_NAME = 'internal_tasks' THEN
    tid := NEW.id; pid := NEW.project_id;
    IF TG_OP = 'INSERT' THEN typ := 'taak_aangemaakt'; s := 'Taak aangemaakt: ' || NEW.title;
    ELSE
      IF NEW.project_id IS DISTINCT FROM OLD.project_id AND OLD.project_id IS NOT NULL THEN
        INSERT INTO public.internal_project_events(project_id, task_id, event_type, summary, actor_id, actor_kind)
        VALUES (OLD.project_id, NEW.id, 'taak_verplaatst', 'Taak uit project gehaald: ' || NEW.title, auth.uid(), kind);
      END IF;
      s := concat_ws('; ',
        CASE WHEN NEW.title IS DISTINCT FROM OLD.title THEN 'titel gewijzigd (was: ' || left(OLD.title, 120) || ')' END,
        CASE WHEN NEW.description IS DISTINCT FROM OLD.description THEN 'omschrijving gewijzigd' END,
        CASE WHEN NEW.priority IS DISTINCT FROM OLD.priority THEN 'prioriteit ' || NEW.priority END,
        CASE WHEN NEW.project_id IS DISTINCT FROM OLD.project_id THEN 'aan project gekoppeld' END,
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status ' || NEW.status END,
        CASE WHEN NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN CASE WHEN NEW.assignee_id IS NULL THEN 'niet meer toegewezen' ELSE 'toegewezen' END END,
        CASE WHEN NEW.deadline IS DISTINCT FROM OLD.deadline THEN 'deadline gewijzigd' END);
      IF s = '' THEN RETURN NULL; END IF;
      typ := 'taak_gewijzigd'; s := 'Taak ' || NEW.title || ': ' || s;
    END IF;
    IF pid IS NULL THEN RETURN NULL; END IF;
  ELSIF TG_TABLE_NAME = 'internal_project_checkpoints' THEN
    IF TG_OP = 'DELETE' THEN pid := OLD.project_id; typ := 'controlepunt_verwijderd'; s := 'Controlepunt verwijderd: ' || OLD.title;
    ELSIF TG_OP = 'INSERT' THEN pid := NEW.project_id; typ := 'controlepunt_toegevoegd'; s := 'Controlepunt toegevoegd: ' || NEW.title;
    ELSE pid := NEW.project_id; typ := 'controlepunt_gewijzigd'; s := 'Controlepunt bijgewerkt: ' || NEW.title || CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN ' (' || NEW.status || ')' ELSE '' END;
    END IF;
  ELSIF TG_TABLE_NAME = 'internal_project_messages' THEN
    pid := NEW.project_id; typ := NEW.kind || '_geplaatst';
    kind := CASE WHEN NEW.author_kind = 'bronimport' THEN 'bronimport' ELSE kind END;
    s := CASE NEW.kind WHEN 'bronupdate' THEN 'Bronupdate: ' || NEW.source_subject WHEN 'notitie' THEN 'Notitie geplaatst' WHEN 'voortgang' THEN 'Voortgang bijgewerkt' ELSE 'Bericht geplaatst' END;
  ELSIF TG_TABLE_NAME = 'internal_project_participants' THEN
    IF TG_OP = 'DELETE' THEN pid := OLD.project_id; typ := 'deelnemer_verwijderd'; s := 'Deelnemer verwijderd';
    ELSE pid := NEW.project_id; typ := 'deelnemer_toegevoegd'; s := 'Deelnemer toegevoegd'; END IF;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.internal_projects WHERE id = pid) THEN RETURN NULL; END IF;
  INSERT INTO public.internal_project_events(project_id, task_id, event_type, summary, actor_id, actor_kind)
  VALUES (pid, tid, typ, left(s, 500), auth.uid(), kind);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.internal_project_log() FROM PUBLIC, anon, authenticated;

-- Weergavenamen: accountnaam, anders exact één ondubbelzinnig gekoppeld bestuurslid (alleen naam; nooit voor autorisatie).
CREATE OR REPLACE FUNCTION public.list_internal_staff_names()
RETURNS TABLE(user_id uuid, email text, full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text,
    coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
      (SELECT CASE WHEN count(DISTINCT btrim(b.naam)) = 1 THEN min(btrim(b.naam)) END
         FROM public.board_members b
        WHERE u.email IS NOT NULL AND length(btrim(b.naam)) > 0
          AND (lower(btrim(b.email)) = lower(u.email::text) OR lower(btrim(b.bond_email)) = lower(u.email::text))))
  FROM auth.users u
  WHERE public.has_role(auth.uid(),'admin')
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
  ORDER BY u.email
$$;
REVOKE ALL ON FUNCTION public.list_internal_staff_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_staff_names() TO authenticated;