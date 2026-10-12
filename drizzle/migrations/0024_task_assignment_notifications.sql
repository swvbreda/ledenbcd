CREATE TABLE public.task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.internal_tasks(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'task_assigned' CHECK (kind = 'task_assigned'),
  event_key text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Nieuwe taak toegewezen',
  body text NOT NULL DEFAULT 'Er staat een nieuwe taak voor je klaar',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  push_status text NOT NULL DEFAULT 'pending' CHECK (push_status IN ('pending','sending','sent','no_devices','failed','skipped')),
  push_attempts integer NOT NULL DEFAULT 0,
  push_sent integer NOT NULL DEFAULT 0,
  push_total integer NOT NULL DEFAULT 0,
  push_error text,
  push_last_attempt_at timestamptz
);
CREATE INDEX task_notifications_recipient_idx ON public.task_notifications (recipient_id, created_at DESC);
CREATE INDEX task_notifications_push_idx ON public.task_notifications (push_status) WHERE push_status IN ('pending','failed','sending');

GRANT SELECT ON public.task_notifications TO authenticated;
GRANT ALL ON public.task_notifications TO service_role;
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eigen taakmeldingen lezen (alleen beheerders)" ON public.task_notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.mark_task_notifications_read(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  UPDATE public.task_notifications SET read_at = now()
   WHERE id = ANY(_ids) AND recipient_id = auth.uid() AND read_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mark_task_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_task_notifications_read(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_task_assignment_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN RETURN NULL; END IF;
  IF NEW.status = 'afgerond' THEN RETURN NULL; END IF;
  IF NOT public.has_role(NEW.assignee_id, 'admin') THEN RETURN NULL; END IF;
  INSERT INTO public.task_notifications (recipient_id, task_id, event_key)
  VALUES (NEW.assignee_id, NEW.id, NEW.id::text || ':' || NEW.assignee_id::text || ':' || txid_current()::text)
  ON CONFLICT (event_key) DO NOTHING;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.internal_task_assignment_notify() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER internal_tasks_assignment_notify AFTER INSERT OR UPDATE OF assignee_id ON public.internal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.internal_task_assignment_notify();