-- created_at en completed_at server-side; bestaande historische datums blijven ongewijzigd.
CREATE OR REPLACE FUNCTION public.internal_work_provenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
      NEW.created_origin := 'medewerker';
      IF TG_TABLE_NAME = 'internal_tasks' THEN NEW.import_ref := NULL; END IF;
    ELSE
      NEW.created_origin := 'bronimport';
    END IF;
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_origin := OLD.created_origin;
    IF TG_TABLE_NAME = 'internal_tasks' THEN NEW.import_ref := OLD.import_ref; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.internal_work_provenance() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.internal_work_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who uuid;
BEGIN
  IF TG_TABLE_NAME = 'internal_projects' THEN who := NEW.owner_id; ELSE who := NEW.assignee_id; END IF;
  IF who IS NOT NULL AND NOT public.has_role(who,'admin') THEN
    RAISE EXCEPTION 'Verantwoordelijke moet een interne medewerker (beheerder) zijn';
  END IF;
  IF TG_TABLE_NAME = 'internal_tasks' THEN
    IF NEW.status IS DISTINCT FROM 'afgerond' THEN
      NEW.completed_at := NULL;
    ELSIF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'afgerond' THEN
      NEW.completed_at := now();
    ELSE
      NEW.completed_at := OLD.completed_at;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_at := now();
  ELSE NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.internal_work_validate() FROM PUBLIC, anon, authenticated;