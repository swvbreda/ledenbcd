GRANT INSERT ON public.agenda_guest_registrations TO authenticated;
DROP POLICY IF EXISTS "Bestuur voegt gastaanmeldingen toe" ON public.agenda_guest_registrations;
CREATE POLICY "Bestuur voegt gastaanmeldingen toe" ON public.agenda_guest_registrations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()));