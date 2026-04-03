
-- Drop overly permissive policies
DROP POLICY "Extern users can upload org logos" ON storage.objects;
DROP POLICY "Extern users can update org logos" ON storage.objects;
DROP POLICY "Extern users can delete org logos" ON storage.objects;

-- Recreate with proper scoping
CREATE POLICY "Extern users can upload org logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT eou.org_id::text FROM external_org_users eou WHERE eou.user_id = auth.uid()
    )
  );

CREATE POLICY "Extern users can update org logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT eou.org_id::text FROM external_org_users eou WHERE eou.user_id = auth.uid()
    )
  );

CREATE POLICY "Extern users can delete org logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT eou.org_id::text FROM external_org_users eou WHERE eou.user_id = auth.uid()
    )
  );
