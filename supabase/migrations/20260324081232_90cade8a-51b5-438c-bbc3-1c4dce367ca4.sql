
CREATE OR REPLACE FUNCTION public.notify_on_external_survey_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only notify for external (PCN) responses (have respondent_email and pending status)
  IF NEW.respondent_email IS NOT NULL AND NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'title', 'Nieuwe PCN-response',
        'body', 'Er is een nieuwe externe enquête-response binnengekomen ter goedkeuring.',
        'target_role', 'admin'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_external_survey_response
  AFTER INSERT ON public.survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_external_survey_response();
