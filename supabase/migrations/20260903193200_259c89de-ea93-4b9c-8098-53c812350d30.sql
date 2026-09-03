ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS share_code text;

CREATE OR REPLACE FUNCTION public.generate_agenda_share_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.agenda_events WHERE share_code = code);
  END LOOP;
  RETURN code;
END;
$$;

UPDATE public.agenda_events SET share_code = public.generate_agenda_share_code() WHERE share_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agenda_events_share_code_key ON public.agenda_events (share_code);

CREATE OR REPLACE FUNCTION public.agenda_set_share_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.share_code IS NULL THEN
    NEW.share_code := public.generate_agenda_share_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_set_share_code ON public.agenda_events;
CREATE TRIGGER trg_agenda_set_share_code
BEFORE INSERT ON public.agenda_events
FOR EACH ROW EXECUTE FUNCTION public.agenda_set_share_code();

CREATE OR REPLACE FUNCTION public.get_agenda_share(_code text)
RETURNS TABLE(id uuid, title text, event_date date, start_time time without time zone, end_time time without time zone, location text, event_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.location, e.event_type::text
  FROM public.agenda_events e
  WHERE upper(e.share_code) = upper(_code)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_agenda_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agenda_share(text) TO anon, authenticated, service_role;