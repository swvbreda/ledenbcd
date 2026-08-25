ALTER TABLE public.coffeeshop_member_links
  ADD COLUMN IF NOT EXISTS location_key text;

CREATE INDEX IF NOT EXISTS idx_coffeeshop_member_links_member_location
  ON public.coffeeshop_member_links (member_id, location_key);