CREATE TABLE public.bank_statement_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  file_name text NOT NULL,
  opening_balance numeric,
  closing_balance numeric,
  imported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_uploads TO authenticated;
GRANT ALL ON public.bank_statement_uploads TO service_role;

ALTER TABLE public.bank_statement_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank_statement_uploads"
  ON public.bank_statement_uploads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.bank_statement_uploads(id) ON DELETE CASCADE,
  year integer NOT NULL,
  transaction_date date,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  counterparty text,
  description text,
  invoice_reference text,
  amount numeric NOT NULL DEFAULT 0,
  row_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, row_hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank_transactions"
  ON public.bank_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX bank_statement_uploads_year_created_idx
  ON public.bank_statement_uploads (year, created_at DESC);

CREATE INDEX bank_transactions_year_date_idx
  ON public.bank_transactions (year, transaction_date DESC, created_at DESC);

CREATE INDEX bank_transactions_upload_idx
  ON public.bank_transactions (upload_id);