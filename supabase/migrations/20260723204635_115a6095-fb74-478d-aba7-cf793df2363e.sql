
-- Fix Katsu (#52) reconciliation
-- 1) Factuur 2026064 was €1.000 in Informer, maar de bank en de werkelijke contributie zijn €3.000
UPDATE public.contribution_invoices
SET amount = 3000
WHERE invoice_number = '2026064' AND member_id = 52;

-- 2) De bijschrijving van €1.000 op 07-04-2026 met omschrijving 2025118 hoort bij boekjaar 2025
INSERT INTO public.contribution_payments (member_id, year, amount, installment_number, installment_count, status, payment_method, stripe_session_id, paid_at)
VALUES (52, 2025, 1000, 1, 1, 'paid', 'bank', 'manual:katsu-2025118-topup', '2026-04-07 00:00:00+00')
ON CONFLICT DO NOTHING;

-- 3) Corrigeer de ponto_transactions koppeling voor de €1.000 (jaar 2025)
UPDATE public.ponto_transactions
SET dossier = 'Contributie #52 (2025118)',
    match_strategy = 'name-prior'
WHERE amount = 1000
  AND executed_at::date = '2026-04-07'
  AND counterparty_name ILIKE '%katsu%';

-- 4) Zorg dat member_contributions correct staat voor 2026 (€3.000 volledig betaald)
UPDATE public.member_contributions
SET amount = 3000, paid = true, paid_date = COALESCE(paid_date, '2026-01-20')
WHERE member_id = 52 AND year = 2026;
