CREATE TABLE public.expense_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_key text NOT NULL,
  dossier text,
  year integer,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  source text NOT NULL DEFAULT 'manual',
  invoice_reference text,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_documents_entry_key ON public.expense_documents(entry_key);
CREATE INDEX idx_expense_documents_dossier ON public.expense_documents(dossier);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_documents TO authenticated;
GRANT ALL ON public.expense_documents TO service_role;

ALTER TABLE public.expense_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/board can view expense documents"
  ON public.expense_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins can insert expense documents"
  ON public.expense_documents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update expense documents"
  ON public.expense_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete expense documents"
  ON public.expense_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));