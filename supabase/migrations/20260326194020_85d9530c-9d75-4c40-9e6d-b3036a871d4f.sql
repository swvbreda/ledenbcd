
-- Drop the ALL policy and create separate ones
DROP POLICY IF EXISTS "Admins can manage contributions" ON public.member_contributions;

CREATE POLICY "Admins can select contributions"
  ON public.member_contributions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert contributions"
  ON public.member_contributions FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contributions"
  ON public.member_contributions FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contributions"
  ON public.member_contributions FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
