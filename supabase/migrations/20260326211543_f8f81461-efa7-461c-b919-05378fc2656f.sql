ALTER TABLE public.member_contributions ADD COLUMN invoice_file_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contribution-invoices', 'contribution-invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can manage contribution invoices"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'contribution-invoices' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'contribution-invoices' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can read own contribution invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contribution-invoices'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1] IN (
      SELECT member_id::text FROM public.member_profiles WHERE user_id = auth.uid()
    )
  )
);