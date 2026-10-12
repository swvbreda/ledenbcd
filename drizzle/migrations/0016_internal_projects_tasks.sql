CREATE TABLE public.internal_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text,
  owner_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'actief' CHECK (status IN ('actief','gepauzeerd','afgerond')),
  teams_url text CHECK (teams_url IS NULL OR teams_url ~* '^https://([a-z0-9-]+\.)*(teams\.microsoft\.com|teams\.live\.com|microsoft\.com|office\.com|sharepoint\.com)(/|$)'),
  archived_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.internal_projects TO authenticated;
GRANT ALL ON public.internal_projects TO service_role;
ALTER TABLE public.internal_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read projects" ON public.internal_projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert projects" ON public.internal_projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND created_by = auth.uid());
CREATE POLICY "Admins update projects" ON public.internal_projects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.internal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text,
  project_id uuid REFERENCES public.internal_projects(id) ON DELETE SET NULL,
  assignee_id uuid,
  deadline date,
  priority text NOT NULL DEFAULT 'normaal' CHECK (priority IN ('laag','normaal','hoog')),
  status text NOT NULL DEFAULT 'te_doen' CHECK (status IN ('te_doen','bezig','wacht','afgerond')),
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX internal_tasks_project_idx ON public.internal_tasks(project_id);
GRANT SELECT, INSERT, UPDATE ON public.internal_tasks TO authenticated;
GRANT ALL ON public.internal_tasks TO service_role;
ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read tasks" ON public.internal_tasks FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert tasks" ON public.internal_tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND created_by = auth.uid());
CREATE POLICY "Admins update tasks" ON public.internal_tasks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Verantwoordelijke moet een bestaand admin-account zijn
CREATE OR REPLACE FUNCTION public.internal_work_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who uuid;
BEGIN
  IF TG_TABLE_NAME = 'internal_projects' THEN who := NEW.owner_id; ELSE who := NEW.assignee_id; END IF;
  IF who IS NOT NULL AND NOT public.has_role(who,'admin') THEN
    RAISE EXCEPTION 'Verantwoordelijke moet een interne medewerker (beheerder) zijn';
  END IF;
  IF TG_TABLE_NAME = 'internal_tasks' THEN
    IF NEW.status = 'afgerond' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
    IF NEW.status <> 'afgerond' THEN NEW.completed_at := NULL; END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER internal_projects_validate BEFORE INSERT OR UPDATE ON public.internal_projects FOR EACH ROW EXECUTE FUNCTION public.internal_work_validate();
CREATE TRIGGER internal_tasks_validate BEFORE INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.internal_work_validate();

-- Lijst van toewijsbare interne accounts; alleen voor admins
CREATE OR REPLACE FUNCTION public.list_internal_staff()
RETURNS TABLE(user_id uuid, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text FROM auth.users u
  WHERE public.has_role(auth.uid(),'admin')
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
  ORDER BY u.email
$$;
REVOKE ALL ON FUNCTION public.list_internal_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_staff() TO authenticated;
REVOKE ALL ON FUNCTION public.internal_work_validate() FROM PUBLIC, anon, authenticated;