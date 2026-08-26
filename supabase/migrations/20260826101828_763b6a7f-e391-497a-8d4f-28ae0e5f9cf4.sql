CREATE OR REPLACE FUNCTION public.ensure_member_link()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  linked integer := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT lower(trim(u.email)) INTO uemail FROM auth.users u WHERE u.id = uid;
  IF uemail IS NULL OR uemail = '' THEN
    RETURN 0;
  END IF;

  WITH ins AS (
    INSERT INTO public.member_profiles (user_id, member_id)
    SELECT uid, a.member_id
    FROM public.member_allowed_emails a
    WHERE a.email = uemail
      AND NOT EXISTS (
        SELECT 1 FROM public.member_profiles p
        WHERE p.user_id = uid AND p.member_id = a.member_id
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO linked FROM ins;

  RETURN linked;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_member_link() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_member_link() TO authenticated;

-- Eenmalige backfill voor bestaande accounts
INSERT INTO public.member_profiles (user_id, member_id)
SELECT u.id, a.member_id
FROM auth.users u
JOIN public.member_allowed_emails a ON a.email = lower(trim(u.email))
WHERE NOT EXISTS (
  SELECT 1 FROM public.member_profiles p
  WHERE p.user_id = u.id AND p.member_id = a.member_id
);