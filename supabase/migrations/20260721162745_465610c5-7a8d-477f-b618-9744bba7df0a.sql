CREATE OR REPLACE FUNCTION public.get_membership_request_status(_email text)
RETURNS TABLE(status text, created_at timestamptz, has_login boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mr.status,
    mr.created_at,
    EXISTS (
      SELECT 1 FROM public.member_allowed_emails mae
      WHERE mae.email = lower(trim(_email))
    ) AS has_login
  FROM public.membership_requests mr
  WHERE lower(trim(mr.email)) = lower(trim(_email))
  ORDER BY mr.created_at DESC
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_membership_request_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_membership_request_status(text) TO anon, authenticated;