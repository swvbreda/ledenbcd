
-- Extend app_role enum with 'extern' for external parties (banks/government)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'extern';

-- Table for external organizations (banks, government bodies)
CREATE TABLE public.external_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'bank', -- 'bank', 'overheid', 'anders'
  contact_email text,
  contact_name text,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.external_organizations ENABLE ROW LEVEL SECURITY;

-- Link external org to a user account
CREATE TABLE public.external_org_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.external_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.external_org_users ENABLE ROW LEVEL SECURITY;

-- Consent table: members grant access per organization
CREATE TABLE public.member_data_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  org_id uuid NOT NULL REFERENCES public.external_organizations(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid NOT NULL,
  revoked_at timestamptz,
  UNIQUE(member_id, org_id)
);

ALTER TABLE public.member_data_consents ENABLE ROW LEVEL SECURITY;

-- RLS: external_organizations
CREATE POLICY "Admins can manage external orgs" ON public.external_organizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Extern users can read own org" ON public.external_organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT org_id FROM public.external_org_users WHERE user_id = auth.uid()));

CREATE POLICY "Members can read approved orgs" ON public.external_organizations
  FOR SELECT TO authenticated
  USING (approved = true AND public.has_role(auth.uid(), 'user'));

-- RLS: external_org_users
CREATE POLICY "Admins can manage org users" ON public.external_org_users
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own org link" ON public.external_org_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS: member_data_consents
CREATE POLICY "Admins can manage consents" ON public.member_data_consents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can manage own consents" ON public.member_data_consents
  FOR ALL TO authenticated
  USING (member_id IN (SELECT mp.member_id FROM member_profiles mp WHERE mp.user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT mp.member_id FROM member_profiles mp WHERE mp.user_id = auth.uid()));

CREATE POLICY "Extern users can read consents for their org" ON public.member_data_consents
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.external_org_users WHERE user_id = auth.uid()));
