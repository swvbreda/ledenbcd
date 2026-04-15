CREATE TABLE public.budget_year_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer NOT NULL UNIQUE,
  budgeted_member_count integer NOT NULL DEFAULT 0,
  contribution_amount numeric NOT NULL DEFAULT 3000,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_year_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage budget_year_settings"
  ON public.budget_year_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
