CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_todos_type_member_year 
ON public.finance_todos (todo_type, member_id, year) 
WHERE member_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_todos_type_ref_year 
ON public.finance_todos (todo_type, reference_id, year) 
WHERE reference_id IS NOT NULL AND member_id IS NULL;