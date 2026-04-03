
ALTER TABLE public.external_organizations
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS kvk text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS logo_path text;

-- Allow extern users to update their own org
CREATE POLICY "Extern users can update own org"
  ON public.external_organizations
  FOR UPDATE
  TO authenticated
  USING (id IN (SELECT org_id FROM external_org_users WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT org_id FROM external_org_users WHERE user_id = auth.uid()));
