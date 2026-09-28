CREATE POLICY "Service role manages member login requests"
ON public.member_login_link_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);