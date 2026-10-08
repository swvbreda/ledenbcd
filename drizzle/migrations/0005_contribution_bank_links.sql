CREATE TABLE public.contribution_bank_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL UNIQUE REFERENCES public.member_contributions(id) ON DELETE RESTRICT,
  bank_transaction_id uuid NOT NULL UNIQUE REFERENCES public.bank_transactions(id) ON DELETE RESTRICT,
  evidence text NOT NULL DEFAULT 'exact_same_year_member_tag_and_amount',
  batch text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.contribution_bank_links TO authenticated;
GRANT ALL ON public.contribution_bank_links TO service_role;
ALTER TABLE public.contribution_bank_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read contribution bank links" ON public.contribution_bank_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add contribution bank links" ON public.contribution_bank_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.contribution_bank_links IS 'Proof link: one incoming bank receipt per contribution (exact same-year member tag + exact amount). Never alters contribution or bank rows.';