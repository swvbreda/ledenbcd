
-- Budget categories (e.g. "Algemene kosten", "Dagelijks bestuur", "Advieskosten", "Donaties")
CREATE TABLE public.budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage budget_categories"
  ON public.budget_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Budget line items (individual budget lines within a category)
CREATE TABLE public.budget_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.budget_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  budgeted_amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage budget_line_items"
  ON public.budget_line_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Actual expenses linked to a line item
CREATE TABLE public.budget_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id uuid NOT NULL REFERENCES public.budget_line_items(id) ON DELETE CASCADE,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date,
  creditor_name text,
  invoice_reference text,
  source text NOT NULL DEFAULT 'manual',
  pdf_file_path text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage budget_expenses"
  ON public.budget_expenses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Balance items (right side: banksaldo, reserves, etc.)
CREATE TABLE public.budget_balance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'middelen',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_balance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage budget_balance_items"
  ON public.budget_balance_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Free-form notes per year
CREATE TABLE public.budget_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  note text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage budget_notes"
  ON public.budget_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
