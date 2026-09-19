CREATE TABLE public.informer_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type IN ('sales_invoice','purchase_invoice')),
  informer_id text NOT NULL,
  year integer NOT NULL,
  entry_date date,
  due_date date,
  amount_incl numeric NOT NULL DEFAULT 0,
  amount_excl numeric,
  paid_amount numeric NOT NULL DEFAULT 0,
  open_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  status_raw text,
  relation_id text,
  relation_name text,
  relation_number text,
  invoice_number text,
  ledger_account text,
  description text,
  currency text DEFAULT 'EUR',
  raw jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informer_ledger_entries_unique UNIQUE (doc_type, informer_id)
);
CREATE INDEX idx_ledger_year ON public.informer_ledger_entries (year, doc_type);
CREATE INDEX idx_ledger_status ON public.informer_ledger_entries (status);
CREATE INDEX idx_ledger_invoice_number ON public.informer_ledger_entries (invoice_number);

GRANT SELECT ON public.informer_ledger_entries TO authenticated;
GRANT ALL ON public.informer_ledger_entries TO service_role;
ALTER TABLE public.informer_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/board can view ledger entries" ON public.informer_ledger_entries
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));

CREATE TRIGGER trg_ledger_entries_updated_at BEFORE UPDATE ON public.informer_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ledger_entry_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type IN ('sales_invoice','purchase_invoice')),
  informer_id text NOT NULL,
  dossier text,
  line_item_id uuid REFERENCES public.budget_line_items(id) ON DELETE SET NULL,
  note text,
  excluded boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entry_overrides_unique UNIQUE (doc_type, informer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entry_overrides TO authenticated;
GRANT ALL ON public.ledger_entry_overrides TO service_role;
ALTER TABLE public.ledger_entry_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/board can view ledger overrides" ON public.ledger_entry_overrides
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));
CREATE POLICY "Admins can manage ledger overrides" ON public.ledger_entry_overrides
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ledger_overrides_updated_at BEFORE UPDATE ON public.ledger_entry_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ledger_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type IN ('sales_invoice','purchase_invoice')),
  informer_id text NOT NULL,
  ponto_transaction_id uuid NOT NULL REFERENCES public.ponto_transactions(id) ON DELETE CASCADE,
  matched_by text NOT NULL DEFAULT 'auto' CHECK (matched_by IN ('auto','manual')),
  confidence numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_payment_links_unique_tx UNIQUE (ponto_transaction_id)
);
CREATE INDEX idx_payment_links_entry ON public.ledger_payment_links (doc_type, informer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_payment_links TO authenticated;
GRANT ALL ON public.ledger_payment_links TO service_role;
ALTER TABLE public.ledger_payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/board can view payment links" ON public.ledger_payment_links
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));
CREATE POLICY "Admins can manage payment links" ON public.ledger_payment_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_payment_links_updated_at BEFORE UPDATE ON public.ledger_payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE VIEW public.ledger_entries_v
WITH (security_invoker = on) AS
SELECT
  e.id,
  e.doc_type,
  e.informer_id,
  e.year,
  e.entry_date,
  e.due_date,
  e.amount_incl,
  e.amount_excl,
  e.paid_amount,
  e.open_amount,
  e.status,
  e.status_raw,
  e.relation_id,
  e.relation_name,
  e.relation_number,
  e.invoice_number,
  e.ledger_account,
  e.description,
  e.deleted_at,
  e.last_synced_at,
  o.dossier,
  o.line_item_id,
  o.note,
  COALESCE(o.excluded, false) AS excluded,
  (e.deleted_at IS NULL
    AND COALESCE(o.excluded, false) = false
    AND e.status IN ('open','paid')) AS counts_in_totals,
  pl.ponto_transaction_id,
  pt.executed_at AS payment_date
FROM public.informer_ledger_entries e
LEFT JOIN public.ledger_entry_overrides o
  ON o.doc_type = e.doc_type AND o.informer_id = e.informer_id
LEFT JOIN LATERAL (
  SELECT l.ponto_transaction_id
  FROM public.ledger_payment_links l
  WHERE l.doc_type = e.doc_type AND l.informer_id = e.informer_id
  ORDER BY l.created_at
  LIMIT 1
) pl ON true
LEFT JOIN public.ponto_transactions pt ON pt.id = pl.ponto_transaction_id;

GRANT SELECT ON public.ledger_entries_v TO authenticated;
GRANT SELECT ON public.ledger_entries_v TO service_role;