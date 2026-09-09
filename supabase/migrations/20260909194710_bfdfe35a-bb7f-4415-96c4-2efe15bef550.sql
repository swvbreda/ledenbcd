ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS outlook_event_id text,
  ADD COLUMN IF NOT EXISTS outlook_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS outlook_error text;

ALTER TABLE public.agenda_registrations
  ADD COLUMN IF NOT EXISTS outlook_attendee_email text,
  ADD COLUMN IF NOT EXISTS outlook_state text,
  ADD COLUMN IF NOT EXISTS outlook_error text;

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
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/sync-agenda-outlook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := jsonb_build_object('event_id', _event_id, 'action', _action)
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_agenda_outlook_sync(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_agenda_outlook_sync(uuid, text) TO authenticated, service_role;

-- Achtergrondaanroep zonder rechtencontrole, voor gebruik door triggers.
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
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/sync-agenda-outlook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := jsonb_build_object('event_id', _event_id, 'action', _action)
  ) INTO req_id;
EXCEPTION WHEN OTHERS THEN
  -- Synchronisatie mag nooit een aanmelding of wijziging blokkeren.
  RAISE WARNING 'agenda outlook dispatch failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.agenda_outlook_dispatch(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_outlook_dispatch(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.agenda_events_outlook_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.event_type = 'evenement' AND OLD.outlook_event_id IS NOT NULL THEN
      PERFORM public.agenda_outlook_dispatch(OLD.id, 'delete');
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.event_type <> 'evenement' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL THEN
    PERFORM public.agenda_outlook_dispatch(NEW.id, 'delete');
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.event_date IS DISTINCT FROM OLD.event_date
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.end_time IS DISTINCT FROM OLD.end_time
     OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
    PERFORM public.agenda_outlook_dispatch(NEW.id, 'sync');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_events_outlook ON public.agenda_events;
CREATE TRIGGER trg_agenda_events_outlook
AFTER INSERT OR UPDATE OR DELETE ON public.agenda_events
FOR EACH ROW EXECUTE FUNCTION public.agenda_events_outlook_trigger();

CREATE OR REPLACE FUNCTION public.agenda_registrations_outlook_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_id uuid := COALESCE(NEW.event_id, OLD.event_id);
  ev_type text;
BEGIN
  SELECT event_type INTO ev_type FROM public.agenda_events WHERE id = ev_id;
  IF ev_type = 'evenement' THEN
    PERFORM public.agenda_outlook_dispatch(ev_id, 'sync');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_registrations_outlook ON public.agenda_registrations;
CREATE TRIGGER trg_agenda_registrations_outlook
AFTER INSERT OR UPDATE OR DELETE ON public.agenda_registrations
FOR EACH ROW EXECUTE FUNCTION public.agenda_registrations_outlook_trigger();