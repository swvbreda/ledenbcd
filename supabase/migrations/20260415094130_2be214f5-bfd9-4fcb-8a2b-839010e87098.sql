
-- Add file_path column
ALTER TABLE public.finance_todos ADD COLUMN file_path TEXT;

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('finance-todo-files', 'finance-todo-files', false);

-- Storage policies: admins only
CREATE POLICY "Admins can upload finance todo files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'finance-todo-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read finance todo files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'finance-todo-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete finance todo files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'finance-todo-files' AND public.has_role(auth.uid(), 'admin'));
