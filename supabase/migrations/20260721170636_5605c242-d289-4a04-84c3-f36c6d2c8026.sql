
-- 1) Revoke EXECUTE on trigger-only SECURITY DEFINER function from public/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.auto_create_member_from_request() FROM PUBLIC, anon, authenticated;

-- 2) Scope survey_questions anon read to active surveys only
DROP POLICY IF EXISTS "Anon can read survey questions" ON public.survey_questions;
CREATE POLICY "Anon can read survey questions"
ON public.survey_questions
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_questions.survey_id AND s.active = true
  )
);
