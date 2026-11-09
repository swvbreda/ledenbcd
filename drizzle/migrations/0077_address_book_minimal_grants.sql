REVOKE ALL ON public.address_book_organizations, public.address_book_contacts FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.address_book_organizations, public.address_book_contacts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.address_book_organizations, public.address_book_contacts TO authenticated;
GRANT ALL ON public.address_book_organizations, public.address_book_contacts TO service_role;