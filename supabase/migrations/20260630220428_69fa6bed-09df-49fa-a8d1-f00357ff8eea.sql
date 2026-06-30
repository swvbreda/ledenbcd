
ALTER TABLE public.member_contributions ADD COLUMN IF NOT EXISTS external_invoice_id text;

ALTER TABLE public.budget_expenses ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.budget_expenses ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS budget_expenses_external_id_uniq ON public.budget_expenses(external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.informer_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  success boolean NOT NULL,
  items_processed integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb
);
GRANT SELECT ON public.informer_sync_log TO authenticated;
GRANT ALL ON public.informer_sync_log TO service_role;
ALTER TABLE public.informer_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/board can view informer logs" ON public.informer_sync_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE TABLE IF NOT EXISTS public.informer_sync_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_payment_sync_at timestamptz,
  last_creditor_sync_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT informer_sync_state_singleton CHECK (id = 1)
);
INSERT INTO public.informer_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.informer_sync_state TO authenticated;
GRANT ALL ON public.informer_sync_state TO service_role;
ALTER TABLE public.informer_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/board can view informer state" ON public.informer_sync_state
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));
