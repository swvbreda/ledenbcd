
-- Enable realtime for push_device_tokens (optional, for admin monitoring)
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_device_tokens;

-- Create a trigger function that calls the notify-edit-request edge function
CREATE OR REPLACE FUNCTION public.notify_on_edit_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-edit-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object('member_id', NEW.member_id, 'id', NEW.id)
    )
  );
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_new_edit_request
  AFTER INSERT ON public.member_edit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_edit_request();
