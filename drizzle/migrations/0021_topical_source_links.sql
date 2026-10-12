ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS source_system text CHECK (source_system IS NULL OR source_system = 'topical');
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS source_ref text CHECK (source_ref IS NULL OR source_ref ~ '^[0-9]{1,12}$');
ALTER TABLE public.internal_tasks ADD CONSTRAINT internal_tasks_source_pair CHECK ((source_system IS NULL) = (source_ref IS NULL));

-- Idempotente backfill uit de eerste beschrijvingsregel; overschrijft nooit een bestaande bron.
UPDATE public.internal_tasks t
SET source_system = 'topical', source_ref = substring(split_part(t.description, E'\n', 1) from '^Bron: Topical BCD — actie ([0-9]{1,12})\s*$')
WHERE t.source_system IS NULL
  AND split_part(t.description, E'\n', 1) ~ '^Bron: Topical BCD — actie [0-9]{1,12}\s*$';

CREATE UNIQUE INDEX IF NOT EXISTS internal_tasks_source_uniq ON public.internal_tasks (source_system, source_ref) WHERE source_system IS NOT NULL;

-- Bevestigd Microsoft-account + To Do-lijst (één bron). Entra-id is nooit een BCD-uuid.
CREATE TABLE public.topical_todo_source (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  entra_user_id text NOT NULL CHECK (entra_user_id ~ '^[0-9a-fA-F-]{36}$'),
  account_display text,
  list_id text NOT NULL CHECK (list_id ~ '^[A-Za-z0-9_=-]{10,300}$'),
  list_name text,
  confirmed_by uuid NOT NULL DEFAULT auth.uid(),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.topical_todo_source TO authenticated;
GRANT ALL ON public.topical_todo_source TO service_role;
ALTER TABLE public.topical_todo_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read topical source" ON public.topical_todo_source FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert topical source" ON public.topical_todo_source FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND confirmed_by = auth.uid());
CREATE POLICY "Admins update topical source" ON public.topical_todo_source FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin') AND confirmed_by = auth.uid());

CREATE TABLE public.topical_task_links (
  task_id uuid PRIMARY KEY REFERENCES public.internal_tasks(id) ON DELETE CASCADE,
  source_ref text NOT NULL,
  todo_user_id text CHECK (todo_user_id IS NULL OR todo_user_id ~ '^[0-9a-fA-F-]{36}$'),
  todo_list_id text,
  todo_task_id text UNIQUE,
  todo_match text CHECK (todo_match IS NULL OR todo_match IN ('source_id','title_confirmed')),
  todo_completed_at timestamptz,
  planner_plan_id text,
  planner_task_id text UNIQUE,
  planner_match text CHECK (planner_match IS NULL OR planner_match = 'source_id'),
  planner_completed_at timestamptz,
  confirmed_by uuid NOT NULL DEFAULT auth.uid(),
  last_attempt_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.topical_task_links TO authenticated;
GRANT ALL ON public.topical_task_links TO service_role;
ALTER TABLE public.topical_task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read topical links" ON public.topical_task_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert topical links" ON public.topical_task_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update topical links" ON public.topical_task_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Bronverwijzing is server-eigendom en een Topical-taak mag alleen lokaal 'afgerond' worden
-- nadat To Do én Planner bevestigd zijn afgerond.
CREATE OR REPLACE FUNCTION public.topical_task_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.source_system := OLD.source_system; NEW.source_ref := OLD.source_ref;
    IF OLD.source_system = 'topical' AND NEW.status = 'afgerond' AND OLD.status <> 'afgerond' THEN
      IF NOT EXISTS (SELECT 1 FROM public.topical_task_links l WHERE l.task_id = NEW.id
                     AND l.todo_completed_at IS NOT NULL AND l.planner_completed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Topical-taak kan pas lokaal worden afgerond nadat Microsoft To Do en Planner bevestigd zijn afgerond';
      END IF;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.source_system := NULL; NEW.source_ref := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.topical_task_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER topical_task_guard BEFORE INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.topical_task_guard();