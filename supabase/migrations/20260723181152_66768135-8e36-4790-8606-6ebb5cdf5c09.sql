
-- 1. Fix trigger to use per-member required amount when set
CREATE OR REPLACE FUNCTION public.recompute_contribution_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
  v_required numeric;
  v_last_paid timestamptz;
  v_existing_required numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0), MAX(paid_at)
    INTO v_total, v_last_paid
  FROM public.contribution_payments
  WHERE member_id = NEW.member_id AND year = NEW.year AND status = 'paid';

  -- Prefer the per-member required amount if one is already stored
  SELECT amount INTO v_existing_required
  FROM public.member_contributions
  WHERE member_id = NEW.member_id AND year = NEW.year;

  IF v_existing_required IS NOT NULL AND v_existing_required > 0 THEN
    v_required := v_existing_required;
  ELSE
    SELECT COALESCE(contribution_amount, 3000)
      INTO v_required
    FROM public.budget_year_settings WHERE year = NEW.year;
    IF v_required IS NULL THEN v_required := 3000; END IF;
  END IF;

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
$function$;

-- 2. Remove duplicate Informer invoices
-- Hortus de Overkant #2: keep 2026006, drop 25230908 (Informer duplicate)
DELETE FROM public.contribution_invoices
WHERE member_id = 2 AND year = 2026 AND invoice_number = '25230908';

-- Coffeeshop Relax #8: drop stray €630 rest invoice 2026-0003
DELETE FROM public.contribution_invoices
WHERE member_id = 8 AND year = 2026 AND invoice_number = '2026-0003' AND amount = 630;

-- 3. Register missed bank payments as contribution_payments
-- De Molen (#12): €3.000 op 2026-01-27, factuur 2026030
INSERT INTO public.contribution_payments (member_id, year, amount, status, payment_method, paid_at)
SELECT 12, 2026, 3000, 'paid', 'bank', '2026-01-27T00:00:00Z'
WHERE NOT EXISTS (
  SELECT 1 FROM public.contribution_payments
  WHERE member_id = 12 AND year = 2026 AND status = 'paid'
);

-- Hortus de Overkant (#2): €3.000 op 2026-02-20, factuur 2026006
INSERT INTO public.contribution_payments (member_id, year, amount, status, payment_method, paid_at)
SELECT 2, 2026, 3000, 'paid', 'bank', '2026-02-20T00:00:00Z'
WHERE NOT EXISTS (
  SELECT 1 FROM public.contribution_payments
  WHERE member_id = 2 AND year = 2026 AND status = 'paid'
);

-- Dr Pleasure / Pleasure Utrecht (#131): €3.000 op 2026-01-28, factuur 2026009
INSERT INTO public.contribution_payments (member_id, year, amount, status, payment_method, paid_at)
SELECT 131, 2026, 3000, 'paid', 'bank', '2026-01-28T00:00:00Z'
WHERE NOT EXISTS (
  SELECT 1 FROM public.contribution_payments
  WHERE member_id = 131 AND year = 2026 AND status = 'paid'
);

-- 4. Force trigger recompute for Flamingo (#134) and No Limit (#135) so their pro-rated €1.500 is now counted as fully paid
UPDATE public.contribution_payments
SET updated_at = now()
WHERE member_id IN (134, 135) AND year = 2026 AND status = 'paid';
