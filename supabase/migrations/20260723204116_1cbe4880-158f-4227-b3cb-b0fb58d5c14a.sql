
-- 1) Dubbele betaling Dr Pleasure verwijderen (behoort bij Pleasure Utrecht #90)
DELETE FROM public.contribution_payments
WHERE member_id = 131 AND year = 2026 AND amount = 3000 AND payment_method = 'bank';

-- 2) Ruthless #78: 2026-betaling verplaatsen naar 2025
UPDATE public.contribution_payments
SET year = 2025
WHERE member_id = 78 AND year = 2026 AND amount = 1000 AND paid_at::date = '2025-12-29';

-- 3) Happy Feelings #10: 2026-betaling registreren
INSERT INTO public.contribution_payments (member_id, year, amount, status, payment_method, paid_at)
VALUES (10, 2026, 1000, 'paid', 'bank', '2026-04-20 00:00:00+00')
ON CONFLICT DO NOTHING;
