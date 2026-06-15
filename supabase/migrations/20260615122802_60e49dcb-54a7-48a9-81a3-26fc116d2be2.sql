
CREATE OR REPLACE FUNCTION public.notify_on_membership_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/notify-membership-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YmZkcnJpd2F5bmZldXJxa2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTY4OTcsImV4cCI6MjA4OTQzMjg5N30.QmhhJBydIvy_-bcjLqOWsgJGmJr-CZa3gDCDMHNkey8'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'id', NEW.id,
        'full_name', NEW.full_name,
        'email', NEW.email,
        'coffeeshop_name', NEW.coffeeshop_name,
        'city', NEW.city,
        'phone', NEW.phone,
        'message', NEW.message
      )
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_membership_request ON public.membership_requests;
CREATE TRIGGER trg_notify_on_membership_request
  AFTER INSERT ON public.membership_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_membership_request();
