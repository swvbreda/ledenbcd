
-- Users can read survey responses
CREATE POLICY "Users can read survey responses"
ON public.survey_responses
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'user'::app_role));

-- Users can create surveys
CREATE POLICY "Users can insert surveys"
ON public.surveys
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'user'::app_role));

-- Users can update surveys they created
CREATE POLICY "Users can update own surveys"
ON public.surveys
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'user'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'user'::app_role) AND created_by = auth.uid());

-- Users can delete surveys they created
CREATE POLICY "Users can delete own surveys"
ON public.surveys
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'user'::app_role) AND created_by = auth.uid());

-- Users can manage survey questions for surveys they created
CREATE POLICY "Users can insert survey questions for own surveys"
ON public.survey_questions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'user'::app_role) AND
  survey_id IN (SELECT id FROM public.surveys WHERE created_by = auth.uid())
);

CREATE POLICY "Users can update survey questions for own surveys"
ON public.survey_questions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'user'::app_role) AND
  survey_id IN (SELECT id FROM public.surveys WHERE created_by = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'user'::app_role) AND
  survey_id IN (SELECT id FROM public.surveys WHERE created_by = auth.uid())
);

CREATE POLICY "Users can delete survey questions for own surveys"
ON public.survey_questions
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'user'::app_role) AND
  survey_id IN (SELECT id FROM public.surveys WHERE created_by = auth.uid())
);
