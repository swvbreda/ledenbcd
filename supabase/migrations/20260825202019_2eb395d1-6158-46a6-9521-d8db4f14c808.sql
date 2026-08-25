ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_event_id text,
  ADD COLUMN IF NOT EXISTS external_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_agenda_events_external_event_id
  ON public.agenda_events (external_event_id);

CREATE OR REPLACE FUNCTION public.trigger_topical_sync()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
  svc_key text;
BEGIN
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger the Topical sync' USING ERRCODE = '42501';
  END IF;

  SELECT decrypted_secret INTO svc_key
  FROM vault.decrypted_secrets
  WHERE name IN ('supabase_service_role_key','service_role_key','SUPABASE_SERVICE_ROLE_KEY','email_queue_service_role_key')
  ORDER BY CASE name
    WHEN 'supabase_service_role_key' THEN 1
    WHEN 'SUPABASE_SERVICE_ROLE_KEY' THEN 2
    WHEN 'service_role_key' THEN 3
    ELSE 9
  END
  LIMIT 1;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/sync-topical-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_topical_sync() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_topical_sync() TO authenticated, service_role;