CREATE TABLE public.member_login_link_requests (
  email text PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.member_login_link_requests TO service_role;
ALTER TABLE public.member_login_link_requests ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_member_login_link(_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed boolean;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _email IS NULL OR _email <> lower(btrim(_email)) OR length(_email) > 254 THEN
    RETURN false;
  END IF;
  INSERT INTO public.member_login_link_requests(email, requested_at)
    VALUES (_email, now())
    ON CONFLICT (email) DO UPDATE SET requested_at = now(), updated_at = now()
      WHERE member_login_link_requests.requested_at < now() - interval '2 minutes'
    RETURNING true INTO claimed;
  RETURN coalesce(claimed, false);
END; $$;
REVOKE ALL ON FUNCTION public.claim_member_login_link(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_member_login_link(text) TO service_role;