
CREATE OR REPLACE FUNCTION public.notify_on_edit_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/notify-edit-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YmZkcnJpd2F5bmZldXJxa2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTY4OTcsImV4cCI6MjA4OTQzMjg5N30.QmhhJBydIvy_-bcjLqOWsgJGmJr-CZa3gDCDMHNkey8'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object('member_id', NEW.member_id, 'id', NEW.id)
    )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_external_survey_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.respondent_email IS NOT NULL AND NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/notify-survey-response',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YmZkcnJpd2F5bmZldXJxa2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTY4OTcsImV4cCI6MjA4OTQzMjg5N30.QmhhJBydIvy_-bcjLqOWsgJGmJr-CZa3gDCDMHNkey8'
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'record', jsonb_build_object('survey_id', NEW.survey_id, 'respondent_email', NEW.respondent_email)
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;
