-- Minimale geïsoleerde fixture (nooit tegen beheerde database draaien).
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
CREATE TYPE public.app_role AS ENUM ('admin','user','extern','inhuur');
CREATE TABLE public.user_roles (user_id uuid, role app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE TABLE public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text, event_type text NOT NULL, event_date date NOT NULL,
  start_time time, end_time time, location text, is_published boolean NOT NULL DEFAULT false, created_by uuid,
  outlook_event_id text, external_event_id text, cancelled_at timestamptz, cancel_reason text,
  CONSTRAINT agenda_events_type_chk CHECK (event_type = ANY (ARRAY['bestuursvergadering','evenement'])));
CREATE TABLE public.internal_projects (id uuid PRIMARY KEY, archived_at timestamptz);
CREATE TABLE public.internal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, project_id uuid, assignee_id uuid, deadline date,
  priority text NOT NULL DEFAULT 'normaal', status text NOT NULL DEFAULT 'te_doen', created_by uuid NOT NULL, source_system text, source_ref text);
CREATE TABLE public.task_notifications (recipient_id uuid, task_id uuid, event_key text UNIQUE);
CREATE TABLE public.planner_project_links (project_id uuid PRIMARY KEY, plan_id text, bucket_id text);
CREATE TABLE public.planner_task_links (task_id uuid PRIMARY KEY, planner_task_id text);
CREATE TABLE public.planner_user_map (user_id uuid PRIMARY KEY, entra_id text NOT NULL);
CREATE FUNCTION public.internal_task_assignment_notify() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
CREATE TRIGGER internal_tasks_assignment_notify AFTER INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.internal_task_assignment_notify();
