CREATE OR REPLACE FUNCTION public.internal_project_row_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who uuid;
BEGIN
  IF TG_TABLE_NAME = 'internal_project_participants' THEN
    who := (to_jsonb(NEW)->>'user_id')::uuid;
  ELSE
    who := (to_jsonb(NEW)->>'owner_id')::uuid;
  END IF;
  IF who IS NOT NULL AND NOT public.has_role(who,'admin') THEN
    RAISE EXCEPTION 'Alleen interne medewerkers (beheerders) zijn toegestaan';
  END IF;
  IF TG_TABLE_NAME = 'internal_project_participants' THEN
    NEW.added_by := auth.uid(); NEW.added_at := now();
  ELSIF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.created_at := now(); NEW.updated_by := auth.uid(); NEW.updated_at := now();
  ELSE
    NEW.project_id := OLD.project_id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid(); NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.internal_project_row_audit() FROM PUBLIC, anon, authenticated;