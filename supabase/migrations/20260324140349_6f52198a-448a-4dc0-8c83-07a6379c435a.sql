
CREATE OR REPLACE FUNCTION public.notify_on_edit_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _url text;
BEGIN
  SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  IF _url IS NULL THEN
    RAISE WARNING 'SUPABASE_URL not found in vault';
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := _url || '/functions/v1/notify-edit-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_WEBHOOK_SECRET' LIMIT 1)
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
DECLARE
  _url text;
  _key text;
BEGIN
  IF NEW.respondent_email IS NOT NULL AND NEW.status = 'pending' THEN
    SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
    IF _url IS NULL THEN
      RAISE WARNING 'SUPABASE_URL not found in vault';
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      url := _url || '/functions/v1/notify-survey-response',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _key
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

-- Recreate triggers
DROP TRIGGER IF EXISTS on_edit_request ON public.member_edit_requests;
CREATE TRIGGER on_edit_request
  AFTER INSERT ON public.member_edit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_edit_request();

DROP TRIGGER IF EXISTS on_external_survey_response ON public.survey_responses;
CREATE TRIGGER on_external_survey_response
  AFTER INSERT ON public.survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_external_survey_response();
