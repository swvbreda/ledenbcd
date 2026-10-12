CREATE OR REPLACE FUNCTION public.topical_task_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE explicit_local boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.source_system := OLD.source_system; NEW.source_ref := OLD.source_ref;
    explicit_local := COALESCE(OLD.source_system = 'topical'
      AND current_setting('bcd.topical_local_only', true) = NEW.id::text
      AND auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin')
      AND NEW.local_only_completed_by = auth.uid() AND NEW.local_only_completed_at IS NOT NULL, false);
    IF NOT explicit_local THEN
      NEW.local_only_completed_at := OLD.local_only_completed_at;
      NEW.local_only_completed_by := OLD.local_only_completed_by;
    END IF;
    IF OLD.source_system IS NOT DISTINCT FROM 'topical' AND NEW.status = 'afgerond' AND OLD.status IS DISTINCT FROM 'afgerond' AND NOT explicit_local THEN
      IF NOT EXISTS (SELECT 1 FROM public.topical_task_links l WHERE l.task_id = NEW.id
                     AND l.todo_completed_at IS NOT NULL AND l.planner_completed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Topical-taak kan alleen overal (na bevestiging To Do en Planner) of expliciet "Alleen in het ledenbestand" worden afgerond';
      END IF;
    END IF;
    IF NEW.status IS DISTINCT FROM 'afgerond' THEN
      NEW.local_only_completed_at := NULL; NEW.local_only_completed_by := NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.source_system := NULL; NEW.source_ref := NULL;
    NEW.local_only_completed_at := NULL; NEW.local_only_completed_by := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.topical_task_guard() FROM PUBLIC, anon, authenticated;