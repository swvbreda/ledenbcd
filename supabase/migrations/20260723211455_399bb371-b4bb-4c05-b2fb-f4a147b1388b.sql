
DELETE FROM public.budget_expenses
WHERE line_item_id = 'b1000000-0000-0000-0000-000000000006'
  AND direction = 'in';

UPDATE public.ponto_transactions
SET budget_line_item_id = NULL,
    dossier = NULL,
    matched_manually = false,
    matched_rule_id = NULL,
    match_strategy = NULL,
    updated_at = now()
WHERE budget_line_item_id = 'b1000000-0000-0000-0000-000000000006'
  AND amount > 0;

INSERT INTO public.contribution_payments (member_id, year, amount, status, payment_method, paid_at)
VALUES (111, 2026, 3000, 'paid', 'bank', '2026-04-08')
ON CONFLICT DO NOTHING;
