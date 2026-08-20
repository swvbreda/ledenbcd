CREATE TABLE public.expense_dossier_splits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_key text NOT NULL,
  dossier text NOT NULL,
  amount numeric NOT NULL,
  year integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_dossier_splits_entry ON public.expense_dossier_splits (entry_key);
CREATE INDEX idx_expense_dossier_splits_dossier ON public.expense_dossier_splits (dossier);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_dossier_splits TO authenticated;
GRANT ALL ON public.expense_dossier_splits TO service_role;

ALTER TABLE public.expense_dossier_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/board can view dossier splits" ON public.expense_dossier_splits
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));

CREATE POLICY "Admins can insert dossier splits" ON public.expense_dossier_splits
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update dossier splits" ON public.expense_dossier_splits
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete dossier splits" ON public.expense_dossier_splits
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));