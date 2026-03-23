
CREATE TABLE public.members_data (
  id integer PRIMARY KEY,
  member_type text NOT NULL DEFAULT 'member',
  data jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.members_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all members_data"
ON public.members_data FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own member_data"
ON public.members_data FOR SELECT TO authenticated
USING (id IN (SELECT member_id FROM public.member_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert members_data"
ON public.members_data FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update members_data"
ON public.members_data FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete members_data"
ON public.members_data FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
