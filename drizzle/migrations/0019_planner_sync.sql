CREATE TABLE public.planner_project_links (
  project_id uuid PRIMARY KEY REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  group_id text NOT NULL CHECK (group_id ~ '^[0-9a-fA-F-]{36}$'),
  plan_id text NOT NULL UNIQUE CHECK (plan_id ~ '^[A-Za-z0-9_-]{10,64}$'),
  plan_title text,
  linked_by uuid NOT NULL DEFAULT auth.uid(),
  linked_at timestamptz NOT NULL DEFAULT now(),
  lock_until timestamptz,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text
);
GRANT SELECT, INSERT, UPDATE ON public.planner_project_links TO authenticated;
GRANT ALL ON public.planner_project_links TO service_role;
ALTER TABLE public.planner_project_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read planner links" ON public.planner_project_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert planner links" ON public.planner_project_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update planner links" ON public.planner_project_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.planner_user_map (
  user_id uuid PRIMARY KEY,
  entra_id text NOT NULL UNIQUE CHECK (entra_id ~ '^[0-9a-fA-F-]{36}$'),
  entra_display text,
  confirmed_by uuid NOT NULL DEFAULT auth.uid(),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.planner_user_map TO authenticated;
GRANT ALL ON public.planner_user_map TO service_role;
ALTER TABLE public.planner_user_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read planner users" ON public.planner_user_map FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert planner users" ON public.planner_user_map FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND public.has_role(user_id,'admin'));
CREATE POLICY "Admins update planner users" ON public.planner_user_map FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin') AND public.has_role(user_id,'admin'));

CREATE TABLE public.planner_task_links (
  task_id uuid PRIMARY KEY REFERENCES public.internal_tasks(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  planner_task_id text UNIQUE,
  state text NOT NULL DEFAULT 'pending_create' CHECK (state IN ('pending_create','creating','uncertain','linked','conflict','remote_missing')),
  attempt_token uuid,
  attempt_started_at timestamptz,
  task_etag text,
  details_etag text,
  last_local_hash text,
  last_remote_hash text,
  seen_local_hash text,
  seen_remote_hash text,
  local_dirty_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.planner_task_links TO authenticated;
GRANT ALL ON public.planner_task_links TO service_role;
ALTER TABLE public.planner_task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read planner tasks" ON public.planner_task_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert planner tasks" ON public.planner_task_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update planner tasks" ON public.planner_task_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.planner_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.internal_projects(id) ON DELETE CASCADE,
  actor uuid NOT NULL DEFAULT auth.uid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  created_remote int NOT NULL DEFAULT 0,
  updated_remote int NOT NULL DEFAULT 0,
  updated_local int NOT NULL DEFAULT 0,
  conflicts int NOT NULL DEFAULT 0,
  error text
);
GRANT SELECT, INSERT, UPDATE ON public.planner_sync_log TO authenticated;
GRANT ALL ON public.planner_sync_log TO service_role;
ALTER TABLE public.planner_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read planner log" ON public.planner_sync_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert planner log" ON public.planner_sync_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND actor = auth.uid());
CREATE POLICY "Admins update planner log" ON public.planner_sync_log FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Lokale wijziging aan een gekoppelde taak: markeer voor verzending (wachtrij)
CREATE OR REPLACE FUNCTION public.planner_mark_task_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.planner_task_links SET local_dirty_at = now(), updated_at = now() WHERE task_id = NEW.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.planner_mark_task_dirty() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER internal_tasks_planner_dirty AFTER UPDATE ON public.internal_tasks
  FOR EACH ROW WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.deadline IS DISTINCT FROM NEW.deadline OR OLD.priority IS DISTINCT FROM NEW.priority
    OR OLD.status IS DISTINCT FROM NEW.status OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id)
  EXECUTE FUNCTION public.planner_mark_task_dirty();