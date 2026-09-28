-- Prepared only: do not apply until the complete mail/callback rollout is approved.
-- A session created through the Auth API is NOT enough to grant membership.
DROP POLICY IF EXISTS "Users can link own verified member" ON public.member_profiles;

-- Remove stale links whenever a member ceases to be active or the address changes.
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id FROM public.member_profiles p
  JOIN auth.users u ON u.id = p.user_id AND u.email_confirmed_at IS NOT NULL
  JOIN public.member_allowed_emails a ON a.member_id = p.member_id
    AND lower(btrim(a.email)) = lower(btrim(u.email))
  JOIN public.members_data m ON m.id = p.member_id AND m.member_type = 'member'
  WHERE p.user_id = auth.uid()
    AND (SELECT count(DISTINCT a2.member_id) FROM public.member_allowed_emails a2
      JOIN public.members_data m2 ON m2.id = a2.member_id AND m2.member_type = 'member'
      WHERE lower(btrim(a2.email)) = lower(btrim(u.email))) = 1
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_member_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated;

DROP POLICY IF EXISTS "Users can read own member_data" ON public.members_data;
-- Preserve the existing policy name, but require active verified membership.
DROP POLICY IF EXISTS "Members can read own members_data" ON public.members_data;
CREATE POLICY "Members can read active own members_data" ON public.members_data
FOR SELECT TO authenticated USING (id = public.current_member_id());

-- A newly created Auth identity has no 'user' role. Grant it only after the
-- verified email, unique active member, and existing binding all passed.
-- Existing board/admin roles remain untouched.
CREATE OR REPLACE FUNCTION public.ensure_member_link()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id integer; v_email text; v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(btrim(email)) INTO v_email FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RETURN 0; END IF;
  SELECT count(DISTINCT a.member_id), min(a.member_id) INTO v_count, v_id
    FROM public.member_allowed_emails a JOIN public.members_data m
      ON m.id = a.member_id AND m.member_type = 'member'
    WHERE lower(btrim(a.email)) = v_email;
  IF v_count <> 1 OR EXISTS (
    SELECT 1 FROM public.member_profiles WHERE user_id = auth.uid() AND member_id <> v_id
  ) THEN RETURN 0; END IF;
  INSERT INTO public.member_profiles(user_id, member_id) VALUES (auth.uid(), v_id)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.ensure_member_link() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_member_link() TO authenticated;

-- User-role policies elsewhere grant broad reads. Their effective 'user' role
-- must lapse immediately on withdrawal, without touching stored role rows.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _user_id AND r.role = _role
      AND (_role <> 'user' OR (
        _user_id = auth.uid() AND public.current_member_id() IS NOT NULL
      ))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- The old preference policy used a raw email lookup; require the current member.
DROP POLICY IF EXISTS "Members can view their own preference" ON public.whatsapp_preferences;
CREATE POLICY "Members can view their active own preference" ON public.whatsapp_preferences
FOR SELECT TO authenticated USING (member_id = public.current_member_id());
