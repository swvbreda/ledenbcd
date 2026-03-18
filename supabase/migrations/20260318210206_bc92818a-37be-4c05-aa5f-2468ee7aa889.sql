
-- Create storage bucket for bestuur photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('bestuur-photos', 'bestuur-photos', true);

-- Allow authenticated users to upload their own photo (named by their email)
CREATE POLICY "Authenticated users can upload bestuur photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bestuur-photos');

-- Allow anyone to view bestuur photos (public bucket)
CREATE POLICY "Public can view bestuur photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'bestuur-photos');

-- Allow authenticated users to update/delete their own uploads
CREATE POLICY "Users can update own bestuur photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bestuur-photos');

CREATE POLICY "Users can delete own bestuur photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bestuur-photos');
