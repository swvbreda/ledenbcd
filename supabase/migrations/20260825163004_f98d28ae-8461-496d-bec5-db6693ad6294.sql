CREATE TABLE public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'evenement',
  event_date date NOT NULL,
  start_time time,
  end_time time,
  location text,
  max_seats integer,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_events_type_chk CHECK (event_type IN ('bestuursvergadering','evenement')),
  CONSTRAINT agenda_events_seats_chk CHECK (max_seats IS NULL OR max_seats > 0),
  CONSTRAINT agenda_events_unique_meeting UNIQUE (event_type, event_date, title)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_events TO authenticated;
GRANT ALL ON public.agenda_events TO service_role;

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leden zien gepubliceerde agenda-items"
ON public.agenda_events FOR SELECT TO authenticated
USING (is_published OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins beheren agenda-items"
ON public.agenda_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agenda_events_updated_at
BEFORE UPDATE ON public.agenda_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agenda_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  member_id integer NOT NULL,
  guests integer NOT NULL DEFAULT 1,
  note text,
  registered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_registrations_guests_chk CHECK (guests > 0 AND guests <= 50),
  CONSTRAINT agenda_registrations_unique UNIQUE (event_id, member_id)
);

CREATE INDEX idx_agenda_registrations_event ON public.agenda_registrations(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_registrations TO authenticated;
GRANT ALL ON public.agenda_registrations TO service_role;

ALTER TABLE public.agenda_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leden zien eigen aanmeldingen"
ON public.agenda_registrations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR member_id IN (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
);

CREATE POLICY "Leden melden zichzelf aan"
ON public.agenda_registrations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR member_id IN (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
);

CREATE POLICY "Leden wijzigen eigen aanmelding"
ON public.agenda_registrations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR member_id IN (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR member_id IN (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
);

CREATE POLICY "Leden verwijderen eigen aanmelding"
ON public.agenda_registrations FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR member_id IN (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
);

CREATE TRIGGER trg_agenda_registrations_updated_at
BEFORE UPDATE ON public.agenda_registrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.agenda_check_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max integer;
  v_used integer;
BEGIN
  SELECT max_seats INTO v_max FROM public.agenda_events WHERE id = NEW.event_id;
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
$$;

CREATE TRIGGER trg_agenda_capacity
BEFORE INSERT OR UPDATE ON public.agenda_registrations
FOR EACH ROW EXECUTE FUNCTION public.agenda_check_capacity();