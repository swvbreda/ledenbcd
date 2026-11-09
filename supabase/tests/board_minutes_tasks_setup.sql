CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
CREATE TYPE public.app_role AS ENUM('admin','user','extern','inhuur');
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.board_members(naam text,email text,bond_email text,id uuid DEFAULT gen_random_uuid() PRIMARY KEY,type text DEFAULT 'bestuurslid');
CREATE TABLE public.account_access_revocations(user_id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role::text=$2)$$;
CREATE FUNCTION public.is_board_member(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT $1='00000000-0000-0000-0000-000000000002'::uuid$$;
CREATE FUNCTION public.contact_account_active() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;
CREATE TABLE storage.objects(bucket_id text,name text,metadata jsonb); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT ON storage.objects TO authenticated;
CREATE TABLE public.internal_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text,description text,project_id uuid,source_system text,assignee_id uuid,deadline date,status text DEFAULT 'te_doen',created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),completed_by uuid,completed_at timestamptz);
GRANT SELECT,INSERT,UPDATE ON public.internal_tasks TO authenticated;
ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks ON public.internal_tasks TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.planner_task_links(task_id uuid); CREATE TABLE public.outlook_deadline_outbox(task_id uuid);
CREATE TABLE public.task_notifications(recipient_id uuid,task_id uuid,event_key text UNIQUE);
CREATE FUNCTION public.outlook_deadline_enqueue(uuid) RETURNS void LANGUAGE sql AS $$INSERT INTO public.outlook_deadline_outbox VALUES($1)$$;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001','tester@example.invalid','{"full_name":"Tester One"}',NULL,NULL),('00000000-0000-0000-0000-000000000006','other@example.invalid','{"full_name":"Other Person"}',NULL,NULL);
INSERT INTO public.user_roles VALUES('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000006','admin');
INSERT INTO public.board_members(naam,email,bond_email) VALUES('Tester One','tester@example.invalid',NULL),('Other Person','other@example.invalid',NULL);
INSERT INTO auth.users VALUES
('00000000-0000-0000-0000-000000000007','boardonly@example.invalid','{}',NULL,NULL),
('00000000-0000-0000-0000-000000000008','aspirant@example.invalid','{}',NULL,NULL),
('00000000-0000-0000-0000-000000000009','notboard@example.invalid','{}',NULL,NULL),
('00000000-0000-0000-0000-000000000010','banned@example.invalid','{}',NULL,'2099-01-01'),
('00000000-0000-0000-0000-000000000011','tester-member@example.invalid','{}',NULL,NULL);
INSERT INTO public.user_roles VALUES('00000000-0000-0000-0000-000000000008','admin'),('00000000-0000-0000-0000-000000000009','admin');
INSERT INTO public.board_members(naam,email,bond_email,type) VALUES
('Board Only','boardonly@example.invalid',NULL,'bestuurslid'),
('Aspirant Local','aspirant@example.invalid',NULL,'aspirant'),
('Banned Board','banned@example.invalid',NULL,'bestuurslid'),
('Missing Board',NULL,NULL,'bestuurslid');
UPDATE public.board_members SET bond_email='tester-member@example.invalid' WHERE naam='Tester One';
