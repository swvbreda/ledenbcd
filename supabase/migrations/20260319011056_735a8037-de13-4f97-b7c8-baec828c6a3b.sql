
CREATE TABLE public.member_mailing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, email)
);

ALTER TABLE public.member_mailing_preferences ENABLE ROW LEVEL SECURITY;

-- Members can view their own mailing preferences
CREATE POLICY "Members can view own mailing preferences"
ON public.member_mailing_preferences
FOR SELECT
TO authenticated
USING (
  member_id = (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid() LIMIT 1)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Members can insert their own mailing preferences
CREATE POLICY "Members can insert own mailing preferences"
ON public.member_mailing_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  member_id = (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid() LIMIT 1)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Members can delete their own mailing preferences
CREATE POLICY "Members can delete own mailing preferences"
ON public.member_mailing_preferences
FOR DELETE
TO authenticated
USING (
  member_id = (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid() LIMIT 1)
  OR has_role(auth.uid(), 'admin'::app_role)
);
