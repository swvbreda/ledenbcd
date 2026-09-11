ALTER TABLE public.agenda_registrations
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_registrations TO authenticated;
GRANT ALL ON public.agenda_registrations TO service_role;