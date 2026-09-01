ALTER TABLE public.coffeeshop_register
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_pad text,
  ADD COLUMN IF NOT EXISTS socials jsonb,
  ADD COLUMN IF NOT EXISTS oprichtingsdatum date,
  ADD COLUMN IF NOT EXISTS oprichtingsdatum_bron text,
  ADD COLUMN IF NOT EXISTS shopcode text,
  ADD COLUMN IF NOT EXISTS bag_pand_id text,
  ADD COLUMN IF NOT EXISTS bag_verblijfsobject_id text,
  ADD COLUMN IF NOT EXISTS verrijkt_op timestamptz;