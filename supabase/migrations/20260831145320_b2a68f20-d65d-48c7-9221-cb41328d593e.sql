CREATE TABLE IF NOT EXISTS public.beleidsmonitor_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer,
  extern_id text,
  naam text,
  gemeente text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS beleidsmonitor_dossiers_key
  ON public.beleidsmonitor_dossiers (COALESCE(extern_id, member_id::text));

GRANT SELECT ON public.beleidsmonitor_dossiers TO authenticated;
GRANT ALL ON public.beleidsmonitor_dossiers TO service_role;
ALTER TABLE public.beleidsmonitor_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins kunnen dossiers bekijken"
  ON public.beleidsmonitor_dossiers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_beleidsmonitor_dossiers_updated
  BEFORE UPDATE ON public.beleidsmonitor_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.beleidsmonitor_sync_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_push_at timestamptz,
  last_push_count integer NOT NULL DEFAULT 0,
  last_pull_at timestamptz,
  last_pull_count integer NOT NULL DEFAULT 0,
  last_status text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beleidsmonitor_sync_state_single CHECK (id = 1)
);

INSERT INTO public.beleidsmonitor_sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.beleidsmonitor_sync_state TO authenticated;
GRANT ALL ON public.beleidsmonitor_sync_state TO service_role;
ALTER TABLE public.beleidsmonitor_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins kunnen syncstatus bekijken"
  ON public.beleidsmonitor_sync_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.trigger_beleidsmonitor_sync()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger the beleidsmonitor sync' USING ERRCODE = '42501';
  END IF;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/beleidsmonitor-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_beleidsmonitor_sync() FROM anon;
GRANT EXECUTE ON FUNCTION public.trigger_beleidsmonitor_sync() TO authenticated;

SELECT cron.schedule(
  'beleidsmonitor-daily-sync',
  '30 4 * * *',
  $cron$ SELECT public.trigger_beleidsmonitor_sync(); $cron$
);