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
  IF TG_TABLE_NAME = 'dossier_register' THEN
    IF NEW.parent_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.dossier_register WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Subdossiers mogen maar een niveau diep zijn';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.dossier_register_guard() FROM PUBLIC, anon, authenticated;