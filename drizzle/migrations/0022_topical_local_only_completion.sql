ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS local_only_completed_at timestamptz;
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS local_only_completed_by uuid;
COMMENT ON COLUMN public.internal_tasks.local_only_completed_at IS 'Expliciet alleen in ledenbestand afgerond (Topical); zegt niets over To Do/Planner.';

CREATE OR REPLACE FUNCTION public.topical_task_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE explicit_local boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.source_system := OLD.source_system; NEW.source_ref := OLD.source_ref;
    explicit_local := OLD.source_system = 'topical'
      AND current_setting('bcd.topical_local_only', true) = NEW.id::text
      AND auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin')
      AND NEW.local_only_completed_by = auth.uid() AND NEW.local_only_completed_at IS NOT NULL;
    IF NOT explicit_local THEN
      -- Lokaal-afgerond-audit is alleen via de expliciete RPC te zetten.
      NEW.local_only_completed_at := OLD.local_only_completed_at;
      NEW.local_only_completed_by := OLD.local_only_completed_by;
    END IF;
    IF OLD.source_system = 'topical' AND NEW.status = 'afgerond' AND OLD.status <> 'afgerond' AND NOT explicit_local THEN
      IF NOT EXISTS (SELECT 1 FROM public.topical_task_links l WHERE l.task_id = NEW.id
                     AND l.todo_completed_at IS NOT NULL AND l.planner_completed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Topical-taak kan alleen overal (na bevestiging To Do en Planner) of expliciet "Alleen in het ledenbestand" worden afgerond';
      END IF;
    END IF;
    IF NEW.status <> 'afgerond' THEN
      NEW.local_only_completed_at := NULL; NEW.local_only_completed_by := NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.source_system := NULL; NEW.source_ref := NULL;
    NEW.local_only_completed_at := NULL; NEW.local_only_completed_by := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.topical_task_guard() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.topical_complete_local_only(_task_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ts timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Geen toegang: alleen beheerders.';
  END IF;
  PERFORM set_config('bcd.topical_local_only', _task_id::text, true);
  UPDATE public.internal_tasks SET status = 'afgerond', local_only_completed_at = ts, local_only_completed_by = auth.uid()
  WHERE id = _task_id AND source_system = 'topical' AND status <> 'afgerond';
  IF NOT FOUND THEN
    PERFORM set_config('bcd.topical_local_only', '', true);
    RAISE EXCEPTION 'Geen open Topical-taak gevonden.';
  END IF;
  PERFORM set_config('bcd.topical_local_only', '', true);
  RETURN ts;
END $$;
REVOKE ALL ON FUNCTION public.topical_complete_local_only(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topical_complete_local_only(uuid) TO authenticated;