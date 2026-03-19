-- Table to track lead-to-member conversions
CREATE TABLE public.lead_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id integer NOT NULL UNIQUE,
  lidnummer integer NOT NULL UNIQUE,
  lid_sinds integer,
  factuur_bedrijfsnaam text,
  factuur_kvk text,
  factuur_email text,
  factuur_adres text,
  factuur_postcode text,
  factuur_plaats text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.lead_conversions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage lead conversions
CREATE POLICY "Admins can insert lead conversions"
  ON public.lead_conversions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update lead conversions"
  ON public.lead_conversions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete lead conversions"
  ON public.lead_conversions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read (needed to classify members vs leads)
CREATE POLICY "Authenticated users can read lead conversions"
  ON public.lead_conversions FOR SELECT
  TO authenticated
  USING (true);