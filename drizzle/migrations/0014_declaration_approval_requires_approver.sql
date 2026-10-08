CREATE OR REPLACE FUNCTION public.guard_declaration_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Goedkeuring is alleen geldig als overgang vanuit 'pending' door Bernard of Simone.
  -- Geldt ook voor systeemroutes (auth.uid() IS NULL); bestaande goedgekeurde rijen blijven ongemoeid.
  IF TG_OP = 'INSERT' AND NEW.status IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Nieuwe declaraties kunnen niet direct goedgekeurd of afgewezen worden aangemaakt';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Alleen ingediende declaraties kunnen worden goedgekeurd';
    END IF;
    IF NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL
       OR NOT public.is_declaration_approver(NEW.reviewed_by)
       OR (auth.uid() IS NOT NULL AND NEW.reviewed_by <> auth.uid()) THEN
      RAISE EXCEPTION 'Goedkeuring vereist Bernard of Simone als beoordelaar';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_declaration_approval() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zy_guard_declaration_approval ON public.internal_declarations;
CREATE TRIGGER zy_guard_declaration_approval BEFORE INSERT OR UPDATE ON public.internal_declarations
FOR EACH ROW EXECUTE FUNCTION public.guard_declaration_approval();