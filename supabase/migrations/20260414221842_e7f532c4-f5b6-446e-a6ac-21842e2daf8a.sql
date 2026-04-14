ALTER TABLE public.budget_expenses
ADD COLUMN paid boolean NOT NULL DEFAULT false,
ADD COLUMN paid_date date;