
-- Trigger for edit requests (notify admins)
DROP TRIGGER IF EXISTS on_edit_request ON public.member_edit_requests;
CREATE TRIGGER on_edit_request
  AFTER INSERT ON public.member_edit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_edit_request();

-- Trigger for external survey responses (notify admins)
DROP TRIGGER IF EXISTS on_external_survey_response ON public.survey_responses;
CREATE TRIGGER on_external_survey_response
  AFTER INSERT ON public.survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_external_survey_response();
