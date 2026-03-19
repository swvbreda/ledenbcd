-- Fix storage RLS: restrict upload/update/delete to admin only
DROP POLICY IF EXISTS "Users can upload bestuur photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own bestuur photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own bestuur photos" ON storage.objects;

CREATE POLICY "Admins can upload bestuur photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bestuur-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update bestuur photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bestuur-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete bestuur photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bestuur-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));