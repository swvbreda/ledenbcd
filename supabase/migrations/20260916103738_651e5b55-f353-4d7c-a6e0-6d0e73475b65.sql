DROP INDEX IF EXISTS public.agenda_guest_registrations_event_email_uniq;
ALTER TABLE public.agenda_guest_registrations
  ADD CONSTRAINT agenda_guest_registrations_event_email_uniq UNIQUE (event_id, email);