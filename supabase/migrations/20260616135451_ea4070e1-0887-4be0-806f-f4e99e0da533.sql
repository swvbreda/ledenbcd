
-- Block non-admin users from modifying approval columns on external_organizations.
-- The existing "Extern users can update own org" RLS policy allowed full-row UPDATE,
-- which let an extern user set approved=true on their own organisation.

CREATE OR REPLACE FUNCTION public.prevent_extern_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Only admins can modify approval status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Only triggers and service_role should ever call this directly.
REVOKE EXECUTE ON FUNCTION public.prevent_extern_self_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_extern_self_approval_trigger ON public.external_organizations;
CREATE TRIGGER prevent_extern_self_approval_trigger
  BEFORE UPDATE ON public.external_organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_extern_self_approval();
