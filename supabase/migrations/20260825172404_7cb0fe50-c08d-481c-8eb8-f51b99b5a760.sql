ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS image_path text;

CREATE POLICY "Authenticated can view agenda images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agenda-images');

CREATE POLICY "Admins can upload agenda images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'agenda-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update agenda images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'agenda-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete agenda images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'agenda-images' AND public.has_role(auth.uid(), 'admin'::app_role));