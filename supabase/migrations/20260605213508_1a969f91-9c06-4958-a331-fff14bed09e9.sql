
CREATE TABLE public.contribution_payments (
  id uuid primary key default gen_random_uuid(),
  member_id integer not null,
  year integer not null,
  amount numeric not null check (amount > 0),
  installment_number integer not null default 1 check (installment_number between 1 and 2),
  installment_count integer not null default 1 check (installment_count between 1 and 2),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  payment_method text not null default 'stripe' check (payment_method in ('stripe','bank','other')),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  stripe_environment text check (stripe_environment in ('sandbox','live')),
  paid_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX idx_contribution_payments_member_year ON public.contribution_payments(member_id, year);
CREATE INDEX idx_contribution_payments_status ON public.contribution_payments(status);

GRANT SELECT, INSERT, UPDATE ON public.contribution_payments TO authenticated;
GRANT ALL ON public.contribution_payments TO service_role;

ALTER TABLE public.contribution_payments ENABLE ROW LEVEL SECURITY;

-- Admins everything
CREATE POLICY "Admins manage contribution payments"
ON public.contribution_payments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Members can read their own payments
CREATE POLICY "Members read own contribution payments"
ON public.contribution_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.member_profiles mp
    WHERE mp.user_id = auth.uid() AND mp.member_id = contribution_payments.member_id
  )
);

-- Update trigger updated_at
CREATE TRIGGER trg_contribution_payments_updated_at
BEFORE UPDATE ON public.contribution_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- When a payment becomes paid, recompute member_contributions.paid
CREATE OR REPLACE FUNCTION public.recompute_contribution_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_required numeric;
  v_last_paid timestamptz;
BEGIN
  SELECT COALESCE(SUM(amount), 0), MAX(paid_at)
    INTO v_total, v_last_paid
  FROM public.contribution_payments
  WHERE member_id = NEW.member_id AND year = NEW.year AND status = 'paid';

  SELECT COALESCE(contribution_amount, 3000)
    INTO v_required
  FROM public.budget_year_settings WHERE year = NEW.year;

  IF v_required IS NULL THEN v_required := 3000; END IF;

  INSERT INTO public.member_contributions (member_id, year, amount, paid, paid_date, created_by)
  VALUES (
    NEW.member_id,
    NEW.year,
    v_required,
    v_total >= v_required,
    CASE WHEN v_total >= v_required THEN COALESCE(v_last_paid::date, CURRENT_DATE) ELSE NULL END,
    NEW.created_by
  )
  ON CONFLICT (member_id, year) DO UPDATE
    SET paid = EXCLUDED.paid,
        paid_date = CASE WHEN EXCLUDED.paid THEN COALESCE(member_contributions.paid_date, EXCLUDED.paid_date) ELSE member_contributions.paid_date END,
        updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_contribution_paid() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_recompute_contribution_paid
AFTER INSERT OR UPDATE OF status, amount ON public.contribution_payments
FOR EACH ROW EXECUTE FUNCTION public.recompute_contribution_paid();
