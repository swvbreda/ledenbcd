-- Send one push notification when member-facing content becomes available.
-- The request is asynchronous, so publishing content is never blocked by APNs.
CREATE OR REPLACE FUNCTION public.notify_members_on_published_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  notification_title text;
  notification_body text;
  notification_route text;
BEGIN
  IF TG_TABLE_NAME = 'agenda_events' THEN
    IF NEW.event_type <> 'evenement'
       OR NEW.is_published <> true
       OR (TG_OP = 'UPDATE' AND OLD.is_published IS NOT DISTINCT FROM NEW.is_published) THEN
      RETURN NEW;
    END IF;
    notification_title := 'Nieuw evenement';
    notification_body := NEW.title;
    notification_route := '/agenda/' || NEW.id::text;
  ELSIF TG_TABLE_NAME = 'member_benefits' THEN
    IF NEW.active <> true
       OR (TG_OP = 'UPDATE' AND OLD.active IS NOT DISTINCT FROM NEW.active) THEN
      RETURN NEW;
    END IF;
    notification_title := 'Nieuw ledenvoordeel';
    notification_body := NEW.title;
    notification_route := '/ledenvoordelen/' || NEW.id::text;
  ELSE
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'internal_webhook_secret'
        LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'title', notification_title,
      'body', notification_body,
      'target_role', 'members',
      'route', notification_route
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_members_on_published_content() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_members_on_published_content() TO service_role;

DROP TRIGGER IF EXISTS notify_members_on_published_agenda_event ON public.agenda_events;
CREATE TRIGGER notify_members_on_published_agenda_event
AFTER INSERT OR UPDATE ON public.agenda_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_members_on_published_content();

DROP TRIGGER IF EXISTS notify_members_on_active_benefit ON public.member_benefits;
CREATE TRIGGER notify_members_on_active_benefit
AFTER INSERT OR UPDATE ON public.member_benefits
FOR EACH ROW
EXECUTE FUNCTION public.notify_members_on_published_content();
