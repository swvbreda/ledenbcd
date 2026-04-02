
-- Add supplier_org_id to member_benefits to link benefits to supplier organizations
ALTER TABLE public.member_benefits
ADD COLUMN supplier_org_id uuid REFERENCES public.external_organizations(id) ON DELETE SET NULL;

-- Create index for supplier lookups
CREATE INDEX idx_member_benefits_supplier_org ON public.member_benefits(supplier_org_id);

-- Allow suppliers to read their own benefits
CREATE POLICY "Suppliers can read own benefits"
ON public.member_benefits
FOR SELECT
TO authenticated
USING (
  supplier_org_id IN (
    SELECT eou.org_id FROM external_org_users eou
    WHERE eou.user_id = auth.uid()
  )
);

-- Allow suppliers to insert benefits for their org
CREATE POLICY "Suppliers can insert own benefits"
ON public.member_benefits
FOR INSERT
TO authenticated
WITH CHECK (
  supplier_org_id IS NOT NULL
  AND supplier_org_id IN (
    SELECT eou.org_id FROM external_org_users eou
    WHERE eou.user_id = auth.uid()
  )
);

-- Allow suppliers to update their own benefits
CREATE POLICY "Suppliers can update own benefits"
ON public.member_benefits
FOR UPDATE
TO authenticated
USING (
  supplier_org_id IS NOT NULL
  AND supplier_org_id IN (
    SELECT eou.org_id FROM external_org_users eou
    WHERE eou.user_id = auth.uid()
  )
)
WITH CHECK (
  supplier_org_id IS NOT NULL
  AND supplier_org_id IN (
    SELECT eou.org_id FROM external_org_users eou
    WHERE eou.user_id = auth.uid()
  )
);

-- Allow suppliers to delete their own benefits
CREATE POLICY "Suppliers can delete own benefits"
ON public.member_benefits
FOR DELETE
TO authenticated
USING (
  supplier_org_id IS NOT NULL
  AND supplier_org_id IN (
    SELECT eou.org_id FROM external_org_users eou
    WHERE eou.user_id = auth.uid()
  )
);

-- Also allow suppliers to manage their own benefit images
CREATE POLICY "Suppliers can read own benefit images"
ON public.benefit_images
FOR SELECT
TO authenticated
USING (
  benefit_id IN (
    SELECT mb.id FROM member_benefits mb
    JOIN external_org_users eou ON mb.supplier_org_id = eou.org_id
    WHERE eou.user_id = auth.uid()
  )
);

CREATE POLICY "Suppliers can insert own benefit images"
ON public.benefit_images
FOR INSERT
TO authenticated
WITH CHECK (
  benefit_id IN (
    SELECT mb.id FROM member_benefits mb
    JOIN external_org_users eou ON mb.supplier_org_id = eou.org_id
    WHERE eou.user_id = auth.uid()
  )
);

CREATE POLICY "Suppliers can update own benefit images"
ON public.benefit_images
FOR UPDATE
TO authenticated
USING (
  benefit_id IN (
    SELECT mb.id FROM member_benefits mb
    JOIN external_org_users eou ON mb.supplier_org_id = eou.org_id
    WHERE eou.user_id = auth.uid()
  )
);

CREATE POLICY "Suppliers can delete own benefit images"
ON public.benefit_images
FOR DELETE
TO authenticated
USING (
  benefit_id IN (
    SELECT mb.id FROM member_benefits mb
    JOIN external_org_users eou ON mb.supplier_org_id = eou.org_id
    WHERE eou.user_id = auth.uid()
  )
);

-- Allow suppliers to upload to benefit-images storage bucket
CREATE POLICY "Suppliers can upload benefit images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'benefit-images'
  AND EXISTS (
    SELECT 1 FROM external_org_users eou
    JOIN external_organizations eo ON eo.id = eou.org_id
    WHERE eou.user_id = auth.uid()
    AND eo.type = 'leverancier'
    AND eo.approved = true
  )
);

CREATE POLICY "Suppliers can update benefit images storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'benefit-images'
  AND EXISTS (
    SELECT 1 FROM external_org_users eou
    JOIN external_organizations eo ON eo.id = eou.org_id
    WHERE eou.user_id = auth.uid()
    AND eo.type = 'leverancier'
    AND eo.approved = true
  )
);

CREATE POLICY "Suppliers can delete benefit images storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'benefit-images'
  AND EXISTS (
    SELECT 1 FROM external_org_users eou
    JOIN external_organizations eo ON eo.id = eou.org_id
    WHERE eou.user_id = auth.uid()
    AND eo.type = 'leverancier'
    AND eo.approved = true
  )
);
