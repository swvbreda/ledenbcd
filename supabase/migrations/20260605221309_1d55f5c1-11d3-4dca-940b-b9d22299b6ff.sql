DROP POLICY IF EXISTS "Authenticated can read secure_documents metadata" ON public.secure_documents;

CREATE POLICY "Authenticated can read secure_documents metadata"
ON public.secure_documents
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND NOT has_role(auth.uid(), 'extern'::app_role)
);