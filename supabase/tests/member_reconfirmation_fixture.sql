CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.members_data(id integer primary key,data jsonb,member_type text);
CREATE TABLE public.member_edits(member_id integer unique,data jsonb);
CREATE TABLE public.member_notes(id uuid default gen_random_uuid(),member_id integer,note text,created_by uuid);
CREATE TABLE public.suppressed_emails(id uuid default gen_random_uuid(),email text);
CREATE TABLE public.email_unsubscribe_tokens(email text,used_at timestamptz);
CREATE TABLE public.removed_contact_emails(member_id integer,email text);
CREATE TABLE public.email_send_log(message_id text,template_name text,recipient_email text,status text,metadata jsonb);
CREATE TABLE public.member_reconfirmation_requests(id uuid primary key default gen_random_uuid(),campaign text,member_id integer,invoice_number text,created_by uuid,token_hash text unique,sent_at timestamptz,activated_at timestamptz,deadline timestamptz,confirmed_at timestamptz,revoked_at timestamptz,created_at timestamptz default now(),unique(campaign,member_id));
ALTER TABLE public.member_reconfirmation_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_reconfirmation_requests TO service_role;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='11111111-1111-1111-1111-111111111111'::uuid AND $2='admin' $$;
INSERT INTO public.members_data VALUES(10,'{"naam":"Fixture shop","contactpersoon":"Fixture Contact","email":"fixture@example.invalid"}','member'),(25,'{"naam":"Other fixture","contactpersoon":"Other","email":"suppressed@example.invalid"}','member'),(26,'{"naam":"Not approved","contactpersoon":"Other","email":"other@example.invalid"}','member');
INSERT INTO public.member_reconfirmation_requests(id,campaign,member_id,invoice_number,created_by,token_hash,activated_at,deadline) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','contributie-2026-11',10,'2026019','11111111-1111-1111-1111-111111111111',repeat('a',64),now(),now()+interval '30 days'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','contributie-2026-11',25,'2026080','11111111-1111-1111-1111-111111111111',repeat('b',64),now(),now()+interval '30 days'),
('cccccccc-cccc-cccc-cccc-cccccccccccc','contributie-2026-11',26,'2026001','11111111-1111-1111-1111-111111111111',repeat('c',64),now(),now()+interval '30 days');