ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS row_index integer NOT NULL DEFAULT 0;

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_year_row_hash_key;

CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_upload_row_idx
  ON public.bank_transactions (upload_id, row_index);