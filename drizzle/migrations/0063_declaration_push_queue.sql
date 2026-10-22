ALTER TABLE public.declaration_push_settings ADD COLUMN IF NOT EXISTS scheduler_armed boolean NOT NULL DEFAULT false;
ALTER TABLE public.declaration_notifications ADD COLUMN IF NOT EXISTS lock_token uuid;
ALTER TABLE public.declaration_notifications ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE public.declaration_notifications DROP CONSTRAINT IF EXISTS declaration_notifications_push_status_check;
ALTER TABLE public.declaration_notifications ADD CONSTRAINT declaration_notifications_push_status_check
  CHECK (push_status IN ('pending','sending','sent','no_devices','failed','skipped','unknown'));
CREATE INDEX IF NOT EXISTS declaration_notifications_queue_idx ON public.declaration_notifications(push_status, created_at)
  WHERE push_status IN ('pending','failed','sending');

CREATE OR REPLACE FUNCTION public.declaration_submit_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; r uuid; added integer := 0; c integer;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' THEN RETURN NULL; END IF;
  IF NOT coalesce((SELECT enabled FROM public.declaration_push_settings WHERE id), false) THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('declaration_push:' || NEW.id::text, 0));
  SELECT coalesce(max(submission_no), 0) + 1 INTO n FROM public.declaration_notifications WHERE declaration_id = NEW.id;
  FOREACH r IN ARRAY public.declaration_push_recipients() LOOP
    INSERT INTO public.declaration_notifications (declaration_id, recipient_id, submission_no, event_key)
    VALUES (NEW.id, r, n, NEW.id::text || ':' || n::text || ':' || r::text)
    ON CONFLICT (event_key) DO NOTHING;
    GET DIAGNOSTICS c = ROW_COUNT; added := added + c;
  END LOOP;
  IF added > 0 AND coalesce((SELECT scheduler_armed FROM public.declaration_push_settings WHERE id), false) THEN
    BEGIN
      PERFORM cron.alter_job(jobid, active := true) FROM cron.job WHERE jobname = 'declaration-push-queue' AND NOT active;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'declaration push wake: %', SQLERRM; END;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'declaration_submit_notify: %', SQLERRM;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.declaration_submit_notify() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.declaration_push_claim(_limit integer DEFAULT 10, _declaration uuid DEFAULT NULL)
RETURNS TABLE(id uuid, recipient_id uuid, declaration_id uuid, push_attempts integer, lock_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce((SELECT enabled FROM public.declaration_push_settings WHERE declaration_push_settings.id), false) THEN RETURN; END IF;
  UPDATE public.declaration_notifications d SET push_status = 'unknown', lock_token = NULL, lease_until = NULL,
    push_error = 'Afloop onbekend; niet automatisch opnieuw verstuurd'
  WHERE d.push_status = 'sending' AND (d.lease_until IS NULL OR d.lease_until < now());
  RETURN QUERY
  WITH c AS (
    SELECT d.id FROM public.declaration_notifications d
    WHERE (_declaration IS NULL OR d.declaration_id = _declaration)
      AND d.push_attempts < 5
      AND (d.push_status = 'pending'
        OR (d.push_status = 'failed' AND d.push_last_attempt_at < now() - make_interval(mins => (2 ^ d.push_attempts)::int)))
    ORDER BY d.created_at
    LIMIT greatest(1, least(coalesce(_limit, 10), 25))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.declaration_notifications d SET push_status = 'sending', push_attempts = d.push_attempts + 1,
    push_last_attempt_at = now(), lock_token = gen_random_uuid(), lease_until = now() + interval '2 minutes'
  FROM c WHERE d.id = c.id
  RETURNING d.id, d.recipient_id, d.declaration_id, d.push_attempts, d.lock_token;
END $$;
REVOKE ALL ON FUNCTION public.declaration_push_claim(integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.declaration_push_claim(integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.declaration_push_finish(_id uuid, _lock uuid, _status text, _sent integer, _total integer, _error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  IF _status NOT IN ('sent','no_devices','failed','skipped','unknown') THEN RAISE EXCEPTION 'Ongeldige status'; END IF;
  UPDATE public.declaration_notifications SET push_status = _status, push_sent = greatest(_sent,0), push_total = greatest(_total,0),
    push_error = left(_error, 500), lock_token = NULL, lease_until = NULL
  WHERE id = _id AND lock_token = _lock AND push_status = 'sending' AND lease_until >= now();
  GET DIAGNOSTICS c = ROW_COUNT;
  RETURN c = 1;
END $$;
REVOKE ALL ON FUNCTION public.declaration_push_finish(uuid, uuid, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.declaration_push_finish(uuid, uuid, text, integer, integer, text) TO service_role;