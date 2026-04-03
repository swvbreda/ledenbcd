
-- Contact persons table
CREATE TABLE public.external_org_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.external_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.external_org_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org contacts"
  ON public.external_org_contacts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Extern users can read own org contacts"
  ON public.external_org_contacts FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT eou.org_id FROM external_org_users eou WHERE eou.user_id = auth.uid()));

CREATE POLICY "Extern users can insert own org contacts"
  ON public.external_org_contacts FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT eou.org_id FROM external_org_users eou WHERE eou.user_id = auth.uid()));

CREATE POLICY "Extern users can update own org contacts"
  ON public.external_org_contacts FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT eou.org_id FROM external_org_users eou WHERE eou.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT eou.org_id FROM external_org_users eou WHERE eou.user_id = auth.uid()));

CREATE POLICY "Extern users can delete own org contacts"
  ON public.external_org_contacts FOR DELETE
  TO authenticated
  USING (org_id IN (SELECT eou.org_id FROM external_org_users eou WHERE eou.user_id = auth.uid()));

-- Storage bucket for org logos
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true);

CREATE POLICY "Anyone can read org logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

CREATE POLICY "Extern users can upload org logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

CREATE POLICY "Extern users can update org logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'org-logos');

CREATE POLICY "Extern users can delete org logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'org-logos');
