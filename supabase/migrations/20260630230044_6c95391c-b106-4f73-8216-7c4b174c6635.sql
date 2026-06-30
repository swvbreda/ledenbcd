
-- 1) Revoke anon EXECUTE on internal SECURITY DEFINER funcs
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon;

-- 2) Extend extern self-approval trigger to cover more sensitive fields
CREATE OR REPLACE FUNCTION public.prevent_extern_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.kvk IS DISTINCT FROM OLD.kvk
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Only admins can modify approval status or sensitive fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS prevent_extern_self_approval_trg ON public.external_organizations;
CREATE TRIGGER prevent_extern_self_approval_trg
  BEFORE UPDATE ON public.external_organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_extern_self_approval();

-- 3) Audience-scoped access to secure_documents
ALTER TABLE public.secure_documents
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'members';

-- Recreate read policy with audience scope (admin-only documents hidden from members)
DROP POLICY IF EXISTS "Authenticated can read secure_documents metadata" ON public.secure_documents;
CREATE POLICY "Authenticated can read secure_documents metadata"
  ON public.secure_documents
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'user'::app_role)
      AND NOT has_role(auth.uid(), 'extern'::app_role)
      AND audience = 'members'
    )
  );
