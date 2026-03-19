-- Table to store allowed signup emails mapped to member IDs
CREATE TABLE public.member_allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  member_id integer NOT NULL
);

ALTER TABLE public.member_allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only service role / edge functions need access, but allow authenticated read for validation
CREATE POLICY "Authenticated users can check emails"
  ON public.member_allowed_emails FOR SELECT TO authenticated
  USING (true);

-- Table to link auth users to member IDs
CREATE TABLE public.member_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  member_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert profiles"
  ON public.member_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Security definer function to check if email is allowed and get member_id
CREATE OR REPLACE FUNCTION public.get_member_id_for_email(_email text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT member_id FROM public.member_allowed_emails
  WHERE email = lower(trim(_email))
  LIMIT 1
$$;