CREATE TABLE public.address_book_organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
 abbreviation text NOT NULL DEFAULT '',
 category text NOT NULL DEFAULT 'Overig' CHECK (category IN ('Tweede Kamer','Eerste Kamer','Ministerie','Gemeente','Brancheorganisatie','Overig')),
 email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '', postal_code text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.address_book_organizations TO authenticated;
GRANT ALL ON public.address_book_organizations TO service_role;
ALTER TABLE public.address_book_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY address_book_staff ON public.address_book_organizations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_board_member(auth.uid())) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_board_member(auth.uid()));
CREATE TABLE public.address_book_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.address_book_organizations(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
 position text NOT NULL DEFAULT '', department text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.address_book_contacts TO authenticated;
GRANT ALL ON public.address_book_contacts TO service_role;
ALTER TABLE public.address_book_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY address_book_staff ON public.address_book_contacts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_board_member(auth.uid())) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_board_member(auth.uid()));
CREATE INDEX address_book_contacts_organization_idx ON public.address_book_contacts(organization_id);
CREATE INDEX address_book_organizations_name_idx ON public.address_book_organizations(lower(name));