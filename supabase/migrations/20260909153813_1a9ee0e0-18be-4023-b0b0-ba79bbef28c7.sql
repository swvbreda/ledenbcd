ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

CREATE OR REPLACE FUNCTION public.agenda_check_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_max integer;
  v_used integer;
  v_cancelled timestamptz;
BEGIN
  SELECT max_seats, cancelled_at INTO v_max, v_cancelled
  FROM public.agenda_events WHERE id = NEW.event_id;

  IF v_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'Dit agenda-item is geannuleerd; aanmelden is niet meer mogelijk'
      USING ERRCODE = '23514';
  END IF;

  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guests), 0) INTO v_used
  FROM public.agenda_registrations
  WHERE event_id = NEW.event_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_used + NEW.guests > v_max THEN
    RAISE EXCEPTION 'Er zijn nog maar % plaatsen beschikbaar', GREATEST(v_max - v_used, 0)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_agenda_share(text);

CREATE FUNCTION public.get_agenda_share(_code text)
 RETURNS TABLE(id uuid, title text, event_date date, start_time time without time zone, end_time time without time zone, location text, event_type text, image_path text, cancelled_at timestamptz, cancel_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.location, e.event_type::text,
         e.image_path, e.cancelled_at, e.cancel_reason
  FROM public.agenda_events e
  WHERE upper(e.share_code) = upper(_code)
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.get_agenda_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agenda_share(text) TO anon, authenticated, service_role;