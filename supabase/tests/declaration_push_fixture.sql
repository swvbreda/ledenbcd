-- Minimale geïsoleerde fixture voor declaratiepush (alleen lokaal Postgres, nooit productie).
CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
CREATE TYPE public.app_role AS ENUM ('admin','user','extern','inhuur');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, role app_role);
CREATE TABLE public.board_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), naam text, functie text, email text, bond_email text);
CREATE TABLE public.internal_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text NOT NULL DEFAULT 'pending', submitted_by uuid,
  reviewed_by uuid, reviewed_at timestamptz, year int NOT NULL DEFAULT 2026, amount numeric NOT NULL DEFAULT 10,
  informer_status text NOT NULL DEFAULT 'not_sent', receipt_paths text[] NOT NULL DEFAULT '{}');
GRANT SELECT, INSERT, UPDATE ON public.internal_declarations TO authenticated;
