"""Read-only extract of authoritative helper definitions for an isolated PostgreSQL test.
Pipe output into a NEW local database only, then apply migrations 0076/0077 and address_book_rls.sql.
No production rows, credentials or tokens are exported.
"""
import subprocess
print('''CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
CREATE TYPE public.app_role AS ENUM('admin','user','extern','inhuur');
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.member_profiles(user_id uuid,member_id integer);
CREATE TABLE public.board_members(lid_id integer,lid_ids integer[]);''')
for schema,names in [('auth',"'uid'"),('public',"'has_role','is_board_member'")]:
    sql=f"select pg_get_functiondef(oid)||';' from pg_proc where pronamespace='{schema}'::regnamespace and proname in ({names});"
    print(subprocess.run(['psql','-X','-At','-c',sql],capture_output=True,text=True,check=True).stdout)
print('''INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','user'),('00000000-0000-0000-0000-000000000003','user'),('00000000-0000-0000-0000-000000000004','extern'),('00000000-0000-0000-0000-000000000005','inhuur');
INSERT INTO public.member_profiles VALUES ('00000000-0000-0000-0000-000000000002',22),('00000000-0000-0000-0000-000000000003',33);
INSERT INTO public.board_members VALUES (22,'{}');''')
