CREATE OR REPLACE FUNCTION public.seed_board_registrations(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.agenda_registrations (event_id, member_id, board_member_id, guests, attendee_names)
  SELECT _event_id, NULL, b.id, 1, ARRAY[b.naam]
  FROM public.board_members b
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agenda_registrations r
    WHERE r.event_id = _event_id AND r.board_member_id = b.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_board_registrations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_board_registrations(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.agenda_seed_board_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type = 'bestuursvergadering' THEN
    PERFORM public.seed_board_registrations(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_seed_board ON public.agenda_events;
CREATE TRIGGER trg_agenda_seed_board
AFTER INSERT ON public.agenda_events
FOR EACH ROW EXECUTE FUNCTION public.agenda_seed_board_on_insert();

DO $$
DECLARE e record;
BEGIN
  FOR e IN SELECT id FROM public.agenda_events
           WHERE event_type = 'bestuursvergadering' AND event_date >= CURRENT_DATE
  LOOP
    PERFORM public.seed_board_registrations(e.id);
  END LOOP;
END $$;