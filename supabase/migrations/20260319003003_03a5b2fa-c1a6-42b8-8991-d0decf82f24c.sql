-- Allow anon users to check emails for registration
CREATE POLICY "Anon can check emails"
  ON public.member_allowed_emails FOR SELECT TO anon
  USING (true);

-- Allow anon to call the function
GRANT EXECUTE ON FUNCTION public.get_member_id_for_email(text) TO anon;