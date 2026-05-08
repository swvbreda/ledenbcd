
-- Private bucket for secure documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('secure-documents', 'secure-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins (bestuur) can upload/update/delete
CREATE POLICY "Admins can read secure-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'secure-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert secure-documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'secure-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update secure-documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'secure-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete secure-documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'secure-documents' AND has_role(auth.uid(), 'admin'::app_role));

-- Metadata table: one slot per document slug (e.g. 'jaarplan')
CREATE TABLE public.secure_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  file_size_bytes bigint
);

ALTER TABLE public.secure_documents ENABLE ROW LEVEL SECURITY;

-- All authenticated members can see metadata
CREATE POLICY "Authenticated can read secure_documents metadata"
ON public.secure_documents FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
);

CREATE POLICY "Admins manage secure_documents"
ON public.secure_documents FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- View audit log
CREATE TABLE public.secure_document_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.secure_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_email text,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);

ALTER TABLE public.secure_document_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read view audit"
ON public.secure_document_views FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_secure_document_views_doc ON public.secure_document_views(document_id, viewed_at DESC);
