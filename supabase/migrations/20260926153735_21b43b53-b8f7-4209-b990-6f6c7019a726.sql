CREATE OR REPLACE FUNCTION public.notify_admin_on_agenda_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev record; v_shop text; v_name text; v_email text; v_member boolean; v_key text;
BEGIN
  SELECT title, event_date INTO ev FROM public.agenda_events WHERE id = NEW.event_id;
  IF TG_TABLE_NAME = 'agenda_registrations' THEN
    IF NEW.board_member_id IS NOT NULL THEN RETURN NEW; END IF;
    SELECT COALESCE(data->>'naam', data->>'bedrijfsnaam') INTO v_shop FROM public.members_data WHERE id = NEW.member_id;
    v_shop := COALESCE(v_shop, 'Lid #' || NEW.member_id);
    v_name := NEW.contact_name; v_email := NEW.contact_email; v_member := true;
    v_key := 'agenda-admin-notify-reg-' || NEW.id;
  ELSE
    v_shop := NEW.organisatie; v_name := NEW.naam; v_email := NEW.email; v_member := false;
    v_key := 'agenda-admin-notify-guest-' || NEW.id;
  END IF;

  PERFORM net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/send-transactional-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)),
    body := jsonb_build_object(
      'templateName','agenda-new-registration-admin',
      'idempotencyKey', v_key,
      'templateData', jsonb_build_object(
        'eventTitle', ev.title, 'eventDate', to_char(ev.event_date,'DD-MM-YYYY'),
        'shop', v_shop, 'contactName', v_name, 'contactEmail', v_email,
        'guests', NEW.guests, 'isMember', v_member, 'note', NEW.note))
  );

  PERFORM net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret' LIMIT 1)),
    body := jsonb_build_object(
      'title','Nieuwe aanmelding',
      'body', COALESCE(v_shop, v_name, 'Onbekend') || ' voor ' || COALESCE(ev.title,'bijeenkomst'),
      'target_role','admin',
      'route','/agenda/' || NEW.event_id::text)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Agenda admin notify failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_admin_on_agenda_registration() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admin_agenda_reg ON public.agenda_registrations;
CREATE TRIGGER trg_notify_admin_agenda_reg AFTER INSERT ON public.agenda_registrations
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_agenda_registration();

DROP TRIGGER IF EXISTS trg_notify_admin_agenda_guest ON public.agenda_guest_registrations;
CREATE TRIGGER trg_notify_admin_agenda_guest AFTER INSERT ON public.agenda_guest_registrations
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_agenda_registration();