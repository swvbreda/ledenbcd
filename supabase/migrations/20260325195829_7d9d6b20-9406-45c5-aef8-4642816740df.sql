
-- Allow PCN reviewer to also read ALL approved responses (including internal ones without respondent_email)
-- This enables showing aggregated results on the review page
DROP POLICY IF EXISTS "PCN reviewer can read external responses" ON public.survey_responses;

CREATE POLICY "PCN reviewer can read responses"
ON public.survey_responses
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    is_pcn_reviewer(auth.uid())
    AND (
      respondent_email IS NOT NULL
      OR status = 'approved'
    )
  )
);
