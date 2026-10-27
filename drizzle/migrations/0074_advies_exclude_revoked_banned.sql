CREATE OR REPLACE FUNCTION public.advies_is_current_member(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_profiles mp JOIN public.members_data md ON md.id = mp.member_id
    JOIN auth.users u ON u.id = mp.user_id
    WHERE mp.user_id = _user_id AND md.member_type = 'member'
      AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until <= now())
      AND NOT EXISTS (SELECT 1 FROM public.account_access_revocations r WHERE r.user_id = _user_id)
  )
$$;
REVOKE ALL ON FUNCTION public.advies_is_current_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advies_is_current_member(uuid) TO service_role;