-- 1. Contactfoto's afschermen; ledenlogo's blijven leesbaar voor ingelogde gebruikers
DROP POLICY IF EXISTS "member media readable by authenticated" ON storage.objects;

CREATE POLICY "member logos readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'member-logos');

CREATE POLICY "contact photos readable by board or own member"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contact-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_board_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE mp.user_id = auth.uid()
        AND (storage.foldername(objects.name))[1] ~ '^[0-9]+$'
        AND mp.member_id = ((storage.foldername(objects.name))[1])::integer
    )
  )
);

-- 2. Interne functies niet meer aanroepbaar door bezoekers/ingelogde gebruikers
REVOKE EXECUTE ON FUNCTION public.agenda_events_outlook_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_registrations_outlook_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agenda_set_share_code() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_agenda_share_code() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_beleidsmonitor_sync() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_register_enrichment_scoped(integer, uuid) FROM anon;

-- 3. Aanwezigheidsoverzicht alleen voor beheer en bestuur
CREATE OR REPLACE FUNCTION public.get_agenda_board_attendance()
RETURNS TABLE(event_id uuid, naam text, functie text, guests integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid())) THEN
    RAISE EXCEPTION 'Niet toegestaan' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.event_id, b.naam, b.functie, r.guests
  FROM public.agenda_registrations r
  JOIN public.board_members b ON b.id = r.board_member_id
  WHERE r.board_member_id IS NOT NULL
  ORDER BY b.sort_order, b.naam;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_agenda_board_attendance() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_agenda_board_attendance() TO authenticated;