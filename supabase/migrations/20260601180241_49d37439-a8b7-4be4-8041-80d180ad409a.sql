CREATE UNIQUE INDEX IF NOT EXISTS budget_expenses_payment_dedup_idx
ON public.budget_expenses (
  line_item_id,
  direction,
  expense_date,
  round(amount::numeric, 2),
  lower(btrim(coalesce(creditor_name, ''))),
  lower(btrim(coalesce(invoice_reference, '')))
)
WHERE direction = 'out' AND expense_date IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS finance_todos_unmatched_reference_idx
ON public.finance_todos (year, todo_type, reference_id)
WHERE todo_type = 'unmatched_payment' AND reference_id IS NOT NULL;