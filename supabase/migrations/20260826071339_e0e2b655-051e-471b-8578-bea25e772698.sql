ALTER TABLE public.coffeeshop_register
  ADD COLUMN IF NOT EXISTS kvk_vestigingsnummer text,
  ADD COLUMN IF NOT EXISTS kvk_vestiging_datum date,
  ADD COLUMN IF NOT EXISTS kvk_vestiging_checked_at timestamptz;