CREATE TABLE public.declaration_payment_confirmations (
  declaration_id uuid PRIMARY KEY REFERENCES public.internal_declarations(id) ON DELETE RESTRICT,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid,
  source text NOT NULL CHECK (source IN ('beheerdersbevestiging')),
  note text,
  batch text
);
COMMENT ON TABLE public.declaration_payment_confirmations IS 'Lokale menselijke betaalbevestiging. confirmed_at = moment van bevestigen, NIET de betaaldatum. Geen bankbewijs en geen Informer-betaalstatus.';
GRANT SELECT, INSERT ON public.declaration_payment_confirmations TO authenticated;
GRANT ALL ON public.declaration_payment_confirmations TO service_role;
ALTER TABLE public.declaration_payment_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment confirmations" ON public.declaration_payment_confirmations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Submitters read own payment confirmations" ON public.declaration_payment_confirmations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.internal_declarations d WHERE d.id = declaration_id AND d.submitted_by = auth.uid()));
CREATE POLICY "Admins insert payment confirmations" ON public.declaration_payment_confirmations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND confirmed_by = auth.uid());