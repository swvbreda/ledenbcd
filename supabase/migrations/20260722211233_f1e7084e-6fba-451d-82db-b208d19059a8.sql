CREATE TABLE IF NOT EXISTS public.informer_bank_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text UNIQUE NOT NULL,
  name text,
  iban text,
  balance numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  as_of_date date,
  raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.informer_bank_balances TO authenticated;
GRANT ALL ON public.informer_bank_balances TO service_role;
ALTER TABLE public.informer_bank_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/board can view bank balances"
  ON public.informer_bank_balances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_board_member(auth.uid()));

ALTER TABLE public.informer_sync_state ADD COLUMN IF NOT EXISTS last_bank_sync_at timestamptz;