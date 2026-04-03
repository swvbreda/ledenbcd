
-- Add restrictive policy: no direct user access (edge function uses service role)
CREATE POLICY "No direct access" ON public.mfa_email_codes
  FOR ALL USING (false);
