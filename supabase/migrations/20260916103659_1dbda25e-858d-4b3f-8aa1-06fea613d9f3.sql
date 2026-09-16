CREATE TABLE public.agenda_guest_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  naam text NOT NULL,
  organisatie text,
  email text NOT NULL,
  telefoon text,
  guests integer NOT NULL DEFAULT 1 CHECK (guests > 0 AND guests <= 20),
  note text,
  status text NOT NULL DEFAULT 'nieuw',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX agenda_guest_registrations_event_email_uniq
  ON public.agenda_guest_registrations (event_id, lower(email));
CREATE INDEX idx_agenda_guest_registrations_event
  ON public.agenda_guest_registrations (event_id);

GRANT SELECT, UPDATE, DELETE ON public.agenda_guest_registrations TO authenticated;
GRANT ALL ON public.agenda_guest_registrations TO service_role;

ALTER TABLE public.agenda_guest_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bestuur ziet gastaanmeldingen"
  ON public.agenda_guest_registrations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Bestuur beheert gastaanmeldingen"
  ON public.agenda_guest_registrations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE POLICY "Bestuur verwijdert gastaanmeldingen"
  ON public.agenda_guest_registrations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_board_member(auth.uid()));

CREATE TRIGGER trg_agenda_guest_registrations_updated_at
  BEFORE UPDATE ON public.agenda_guest_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();