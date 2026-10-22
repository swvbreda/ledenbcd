SET check_function_bodies = off;
CREATE OR REPLACE FUNCTION public.guard_declaration_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$
;
CREATE OR REPLACE FUNCTION public.is_declaration_approver(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND public.has_role(_user_id, 'admin')
    AND (_user_id = 'a7fce7fa-600b-48ef-8faf-7aea6918660a'::uuid OR public.is_treasurer(_user_id))
$function$
;
CREATE OR REPLACE FUNCTION public.is_treasurer(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members b
    JOIN auth.users u ON u.id = _user_id
    WHERE b.functie ILIKE '%penningmeester%'
      AND lower(u.email) IN (lower(coalesce(b.email, '')), lower(coalesce(b.bond_email, '')))
  )
$function$
;
CREATE TRIGGER zy_guard_declaration_approval BEFORE INSERT OR UPDATE ON public.internal_declarations FOR EACH ROW EXECUTE FUNCTION guard_declaration_approval();
