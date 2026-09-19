CREATE TABLE IF NOT EXISTS public.informer_reconciliation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  reference_expenses numeric,
  reference_revenue numeric,
  measured_expenses numeric,
  measured_revenue numeric,
  reconciled boolean NOT NULL DEFAULT false,
  note text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.informer_reconciliation_checks TO authenticated;
GRANT ALL ON public.informer_reconciliation_checks TO service_role;

ALTER TABLE public.informer_reconciliation_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins/board can view reconciliation checks" ON public.informer_reconciliation_checks;
CREATE POLICY "Admins/board can view reconciliation checks"
  ON public.informer_reconciliation_checks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage reconciliation checks" ON public.informer_reconciliation_checks;
CREATE POLICY "Admins can manage reconciliation checks"
  ON public.informer_reconciliation_checks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_informer_reconciliation_checks_updated_at ON public.informer_reconciliation_checks;
CREATE TRIGGER update_informer_reconciliation_checks_updated_at
  BEFORE UPDATE ON public.informer_reconciliation_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.informer_ledger_entries FROM anon;
REVOKE ALL ON public.ledger_entry_overrides FROM anon;
REVOKE ALL ON public.ledger_payment_links FROM anon;
REVOKE ALL ON public.ledger_entries_v FROM anon;
REVOKE ALL ON public.informer_reconciliation_checks FROM anon;