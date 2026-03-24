
CREATE OR REPLACE FUNCTION public.notify_on_external_survey_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.respondent_email IS NOT NULL AND NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-survey-response',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'record', jsonb_build_object('survey_id', NEW.survey_id, 'respondent_email', NEW.respondent_email)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
