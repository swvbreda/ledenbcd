
-- Allow authenticated users (PCN reviewer) to read external responses they need to review
CREATE POLICY "Users can read external pending responses"
ON public.survey_responses
FOR SELECT
TO authenticated
USING (status = 'pending' AND respondent_email IS NOT NULL);

-- Allow authenticated users with user role to update status of external responses
CREATE POLICY "PCN reviewer can update external response status"
ON public.survey_responses
FOR UPDATE
TO authenticated
USING (respondent_email IS NOT NULL)
WITH CHECK (respondent_email IS NOT NULL);
