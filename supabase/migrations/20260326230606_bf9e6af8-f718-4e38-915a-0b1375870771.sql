CREATE POLICY "Admins can manage allowed emails"
ON public.member_allowed_emails
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can read own allowed emails"
ON public.member_allowed_emails
FOR SELECT
TO authenticated
USING (member_id IN (
  SELECT mp.member_id FROM member_profiles mp WHERE mp.user_id = auth.uid()
));