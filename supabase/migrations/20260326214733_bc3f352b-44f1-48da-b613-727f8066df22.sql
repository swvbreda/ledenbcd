-- New table for multiple invoices per contribution
CREATE TABLE public.contribution_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  year integer NOT NULL,
  invoice_number text,
  invoice_file_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contribution_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contribution invoices rows"
ON public.contribution_invoices FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can read own contribution invoices rows"
ON public.contribution_invoices FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid()
  )
);

-- Migrate existing data from member_contributions
INSERT INTO public.contribution_invoices (member_id, year, invoice_number, invoice_file_path)
SELECT member_id, year, invoice_number, invoice_file_path
FROM public.member_contributions
WHERE invoice_file_path IS NOT NULL;

-- Add the Dampkring Haarlemmerstraat second invoice
INSERT INTO public.contribution_invoices (member_id, year, invoice_number, invoice_file_path)
VALUES (35, 2026, '2026056', '35/2026/lidmaatschap_2026_De_Dampkring_Haarlemmerstraat.pdf');

-- Clean up old columns (keep for now as fallback, can drop later)
-- ALTER TABLE public.member_contributions DROP COLUMN invoice_number, DROP COLUMN invoice_file_path;