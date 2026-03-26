
CREATE TABLE public.member_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  year integer NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  paid_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, year)
);

ALTER TABLE public.member_contributions ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage contributions"
  ON public.member_contributions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Members can read own contributions
CREATE POLICY "Members can read own contributions"
  ON public.member_contributions FOR SELECT
  TO authenticated
  USING (member_id IN (
    SELECT mp.member_id FROM member_profiles mp WHERE mp.user_id = auth.uid()
  ));
