ALTER TABLE public.coffeeshop_register
  ADD COLUMN IF NOT EXISTS logo_gecontroleerd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_gecontroleerd_op timestamptz,
  ADD COLUMN IF NOT EXISTS logo_gecontroleerd_door uuid;