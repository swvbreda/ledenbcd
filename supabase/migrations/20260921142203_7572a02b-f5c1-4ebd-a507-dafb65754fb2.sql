ALTER TABLE public.agenda_outlook_settings
  ADD COLUMN IF NOT EXISTS outlook_dispatch_enabled boolean NOT NULL DEFAULT true;

UPDATE public.agenda_outlook_settings
SET outlook_dispatch_enabled = false, registration_sync_enabled = false, updated_at = now()
WHERE id;

CREATE OR REPLACE FUNCTION public.agenda_outlook_dispatch(_event_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  allowed boolean;
  dispatch_on boolean;
BEGIN
  SELECT outlook_dispatch_enabled INTO dispatch_on FROM public.agenda_outlook_settings WHERE id;
  IF NOT coalesce(dispatch_on, true) THEN
    RAISE WARNING 'agenda outlook dispatch paused (%, %)', _event_id, _action;
    RETURN;
  END IF;

  IF _action = 'attendees' THEN
    SELECT registration_sync_enabled INTO allowed FROM public.agenda_outlook_settings WHERE id;
    IF NOT coalesce(allowed, false) THEN
      RETURN;
    END IF;
  END IF;

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

CREATE OR REPLACE FUNCTION public.trigger_agenda_outlook_sync(_event_id uuid, _action text DEFAULT 'sync'::text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
  dispatch_on boolean;
BEGIN
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger the Outlook sync' USING ERRCODE = '42501';
  END IF;

  IF _action NOT IN ('sync', 'delete') THEN
    RAISE EXCEPTION 'Unknown action %', _action;
  END IF;

  SELECT outlook_dispatch_enabled INTO dispatch_on FROM public.agenda_outlook_settings WHERE id;
  IF NOT coalesce(dispatch_on, true) AND _action <> 'delete' THEN
    RAISE EXCEPTION 'De Outlook-agenda staat tijdelijk op pauze, er worden nu geen uitnodigingen bijgewerkt'
      USING ERRCODE = '22023';
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