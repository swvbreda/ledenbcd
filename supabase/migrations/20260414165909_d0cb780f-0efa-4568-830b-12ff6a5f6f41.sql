
CREATE TABLE public.internal_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL DEFAULT extract(year from now())::integer,
  board_member_name text NOT NULL,
  declaration_type text NOT NULL DEFAULT 'reiskosten',
  appointment text,
  trajectory text,
  km_single numeric,
  km_return numeric,
  km_rate numeric NOT NULL DEFAULT 0.23,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date,
  bank_account text,
  account_holder text,
  max_allowance_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage internal_declarations"
  ON public.internal_declarations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
