CREATE OR REPLACE FUNCTION public.trigger_agenda_outlook_sync(_event_id uuid, _action text DEFAULT 'sync')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger the Outlook sync' USING ERRCODE = '42501';
  END IF;

  IF _action NOT IN ('sync', 'delete') THEN
    RAISE EXCEPTION 'Unknown action %', _action;
  END IF;

  SELECT net.http_post(
    url := 'https://leden.coffeeshopbond.nl/api/public/agenda-outlook-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := jsonb_build_object('event_id', _event_id, 'action', _action)
  ) INTO req_id;

  RETURN req_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_outlook_dispatch(_event_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://leden.coffeeshopbond.nl/api/public/agenda-outlook-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := jsonb_build_object('event_id', _event_id, 'action', _action)
  ) INTO req_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'agenda outlook dispatch failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_agenda_outlook_sync(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_agenda_outlook_sync(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.agenda_outlook_dispatch(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_outlook_dispatch(uuid, text) TO service_role;