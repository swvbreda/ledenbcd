ALTER TABLE public.agenda_registrations
  ADD COLUMN IF NOT EXISTS board_member_id uuid REFERENCES public.board_members(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_registrations ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE public.agenda_registrations
  DROP CONSTRAINT IF EXISTS agenda_registrations_one_attendee;
ALTER TABLE public.agenda_registrations
  ADD CONSTRAINT agenda_registrations_one_attendee
  CHECK ((member_id IS NOT NULL AND board_member_id IS NULL)
      OR (member_id IS NULL AND board_member_id IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS agenda_registrations_event_board_uniq
  ON public.agenda_registrations (event_id, board_member_id)
  WHERE board_member_id IS NOT NULL;

DROP POLICY IF EXISTS "Leden melden zichzelf aan" ON public.agenda_registrations;
DROP POLICY IF EXISTS "Leden verwijderen eigen aanmelding" ON public.agenda_registrations;
DROP POLICY IF EXISTS "Leden wijzigen eigen aanmelding" ON public.agenda_registrations;
DROP POLICY IF EXISTS "Leden zien eigen aanmeldingen" ON public.agenda_registrations;

CREATE POLICY "Leden melden zichzelf aan"
ON public.agenda_registrations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (board_member_id IS NULL AND member_id IN (
        SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid()))
);

CREATE POLICY "Leden zien eigen aanmeldingen"
ON public.agenda_registrations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR member_id IN (
        SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
);

CREATE POLICY "Leden wijzigen eigen aanmelding"
ON public.agenda_registrations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR member_id IN (
        SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (board_member_id IS NULL AND member_id IN (
        SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid()))
);

CREATE POLICY "Leden verwijderen eigen aanmelding"
ON public.agenda_registrations FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR member_id IN (
        SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.get_agenda_board_attendance()
RETURNS TABLE(event_id uuid, naam text, functie text, guests integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.event_id, b.naam, b.functie, r.guests
  FROM public.agenda_registrations r
  JOIN public.board_members b ON b.id = r.board_member_id
  WHERE r.board_member_id IS NOT NULL
  ORDER BY b.sort_order, b.naam
$$;

REVOKE ALL ON FUNCTION public.get_agenda_board_attendance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agenda_board_attendance() TO authenticated;