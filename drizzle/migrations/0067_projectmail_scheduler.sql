-- lovable-cron-fallback-reviewed: Microsoft Graph mail delta must be polled (no subscription infra); job is created inactive, runs only while enabled+armed+verified connection, tick self-pauses otherwise.
ALTER TABLE public.projectmail_settings ADD COLUMN IF NOT EXISTS scheduler_armed boolean NOT NULL DEFAULT false;
GRANT SELECT (scheduler_armed) ON public.projectmail_settings TO authenticated;
UPDATE public.projectmail_settings SET enabled = false, scheduler_armed = false WHERE id;

CREATE TABLE public.projectmail_wake_tokens (
  token_hash text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), used_at timestamptz);
GRANT ALL ON public.projectmail_wake_tokens TO service_role;
ALTER TABLE public.projectmail_wake_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.projectmail_scheduler_status() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'installed', EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'projectmail-pull' AND command = 'SELECT public.projectmail_scheduler_tick();' AND schedule = '*/10 * * * *'),
    'active', coalesce((SELECT active FROM cron.job WHERE jobname = 'projectmail-pull'), false),
    'armed', coalesce((SELECT scheduler_armed FROM public.projectmail_settings WHERE id), false),
    'enabled', coalesce((SELECT enabled FROM public.projectmail_settings WHERE id), false))
$$;

CREATE OR REPLACE FUNCTION public.projectmail_scheduler_tick() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE s record; tok text;
BEGIN
  PERFORM pg_advisory_xact_lock(7700000000000065);
  SELECT enabled, scheduler_armed, connection_state, updated_by INTO s FROM public.projectmail_settings WHERE id;
  IF NOT coalesce(s.enabled AND s.scheduler_armed, false) OR s.connection_state IS DISTINCT FROM 'verbonden'
     OR s.updated_by IS NULL OR NOT coalesce(public.has_role(s.updated_by, 'admin'), false) THEN
    PERFORM cron.alter_job(jobid, active := false) FROM cron.job WHERE jobname = 'projectmail-pull' AND active;
    RETURN;
  END IF;
  DELETE FROM public.projectmail_wake_tokens WHERE created_at < now() - interval '1 day';
  tok := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.projectmail_wake_tokens(token_hash) VALUES (encode(digest(tok, 'sha256'), 'hex'));
  PERFORM net.http_post(
    url := 'https://leden.coffeeshopbond.nl/api/public/projectmail-pull',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-projectmail-wake', tok),
    body := '{}'::jsonb, timeout_milliseconds := 300000);
END $$;

CREATE OR REPLACE FUNCTION public.projectmail_consume_wake(_token text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE n int;
BEGIN
  IF _token IS NULL OR length(_token) <> 64 THEN RETURN false; END IF;
  UPDATE public.projectmail_wake_tokens SET used_at = now()
   WHERE token_hash = encode(digest(_token, 'sha256'), 'hex') AND used_at IS NULL AND created_at > now() - interval '5 minutes';
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n = 1;
END $$;

CREATE OR REPLACE FUNCTION public.projectmail_configure(_enabled boolean, _actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(7700000000000065);
  IF _actor IS NULL OR NOT coalesce(public.has_role(_actor, 'admin'), false) THEN
    RAISE EXCEPTION 'Alleen beheerders' USING ERRCODE = '42501';
  END IF;
  IF _enabled THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'projectmail-pull' AND command = 'SELECT public.projectmail_scheduler_tick();' AND schedule = '*/10 * * * *') THEN
      RAISE EXCEPTION 'Automatische planning niet geïnstalleerd'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.projectmail_settings WHERE id AND connection_state = 'verbonden' AND connection_checked_at > now() - interval '15 minutes') THEN
      RAISE EXCEPTION 'Verbinding niet (recent) geverifieerd'; END IF;
  END IF;
  UPDATE public.projectmail_settings SET enabled = _enabled, scheduler_armed = _enabled, updated_by = _actor, updated_at = now() WHERE id;
  PERFORM cron.alter_job(jobid, active := _enabled) FROM cron.job WHERE jobname = 'projectmail-pull' AND active IS DISTINCT FROM _enabled;
  RETURN public.projectmail_scheduler_status();
END $$;

REVOKE ALL ON FUNCTION public.projectmail_scheduler_status(), public.projectmail_scheduler_tick(), public.projectmail_consume_wake(text), public.projectmail_configure(boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.projectmail_scheduler_status(), public.projectmail_scheduler_tick(), public.projectmail_consume_wake(text), public.projectmail_configure(boolean, uuid) TO service_role;

DO $$ DECLARE j bigint; BEGIN
  SELECT jobid INTO j FROM cron.job WHERE jobname = 'projectmail-pull';
  IF j IS NULL THEN j := cron.schedule('projectmail-pull', '*/10 * * * *', 'SELECT public.projectmail_scheduler_tick();'); END IF;
  PERFORM cron.alter_job(j, schedule := '*/10 * * * *', command := 'SELECT public.projectmail_scheduler_tick();', active := false);
END $$;