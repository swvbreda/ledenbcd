
-- Sync member_contributions.paid with contribution_payments (2026)
UPDATE public.member_contributions mc
SET paid = true,
    paid_date = COALESCE(mc.paid_date, sub.last_paid::date),
    updated_at = now()
FROM (
  SELECT member_id, SUM(amount) AS paid_sum, MAX(paid_at) AS last_paid
  FROM public.contribution_payments
  WHERE status='paid' AND year=2026
  GROUP BY member_id
) sub
WHERE mc.member_id=sub.member_id AND mc.year=2026 AND mc.paid=false AND sub.paid_sum >= mc.amount;

-- Nieuwe leden #134 en #135: single-shop, mid-jaar → contributie €1500 en betaald
UPDATE public.member_contributions
SET amount = 1500,
    paid = true,
    paid_date = COALESCE(paid_date, CURRENT_DATE),
    updated_at = now()
WHERE year=2026 AND member_id IN (134, 135) AND paid=false;
