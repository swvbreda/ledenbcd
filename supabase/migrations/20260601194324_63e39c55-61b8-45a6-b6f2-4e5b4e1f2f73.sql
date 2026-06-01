ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS line_item_id uuid,
  ADD COLUMN IF NOT EXISTS dossier text;