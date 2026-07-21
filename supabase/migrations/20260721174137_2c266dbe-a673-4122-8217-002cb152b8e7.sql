GRANT INSERT ON public.membership_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_requests TO authenticated;
GRANT ALL ON public.membership_requests TO service_role;