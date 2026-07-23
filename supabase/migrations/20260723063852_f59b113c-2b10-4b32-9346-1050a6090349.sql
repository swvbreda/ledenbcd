
-- Ponto transactions
CREATE TABLE IF NOT EXISTS public.ponto_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  transaction_id text NOT NULL,
  executed_at timestamptz,
  value_date date,
  amount numeric NOT NULL,
  currency text DEFAULT 'EUR',
  counterparty_name text,
  counterparty_iban text,
  description text,
  remittance_info text,
  category text,
  dossier text,
  budget_line_item_id uuid REFERENCES public.budget_line_items(id) ON DELETE SET NULL,
  matched_rule_id uuid,
  matched_manually boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_ponto_tx_executed_at ON public.ponto_transactions (executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_tx_line_item ON public.ponto_transactions (budget_line_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_transactions TO authenticated;
GRANT ALL ON public.ponto_transactions TO service_role;
ALTER TABLE public.ponto_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/board can view ponto tx"
  ON public.ponto_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_board_member(auth.uid()));
CREATE POLICY "Admins/board can update ponto tx"
  ON public.ponto_transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_board_member(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE TRIGGER update_ponto_transactions_updated_at
  BEFORE UPDATE ON public.ponto_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Matching rules
CREATE TABLE IF NOT EXISTS public.ponto_matching_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  match_field text NOT NULL DEFAULT 'counterparty', -- 'counterparty' | 'description' | 'any'
  budget_line_item_id uuid REFERENCES public.budget_line_items(id) ON DELETE CASCADE,
  dossier text,
  priority integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_matching_rules TO authenticated;
GRANT ALL ON public.ponto_matching_rules TO service_role;
ALTER TABLE public.ponto_matching_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/board manage matching rules"
  ON public.ponto_matching_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_board_member(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE TRIGGER update_ponto_matching_rules_updated_at
  BEFORE UPDATE ON public.ponto_matching_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track last transaction sync per account
ALTER TABLE public.informer_sync_state ADD COLUMN IF NOT EXISTS last_ponto_tx_sync_at timestamptz;
