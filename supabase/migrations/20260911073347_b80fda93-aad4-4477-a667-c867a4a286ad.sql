DROP TRIGGER IF EXISTS trg_agenda_registrations_outlook ON public.agenda_registrations;

CREATE TRIGGER trg_agenda_registrations_outlook
AFTER INSERT OR DELETE ON public.agenda_registrations
FOR EACH ROW EXECUTE FUNCTION public.agenda_registrations_outlook_trigger();

CREATE TRIGGER trg_agenda_registrations_outlook_upd
AFTER UPDATE OF event_id, member_id, board_member_id, attendee_names, guests
ON public.agenda_registrations
FOR EACH ROW
WHEN (
  OLD.event_id IS DISTINCT FROM NEW.event_id
  OR OLD.member_id IS DISTINCT FROM NEW.member_id
  OR OLD.board_member_id IS DISTINCT FROM NEW.board_member_id
  OR OLD.attendee_names IS DISTINCT FROM NEW.attendee_names
  OR OLD.guests IS DISTINCT FROM NEW.guests
)
EXECUTE FUNCTION public.agenda_registrations_outlook_trigger();