CREATE POLICY "Members can insert anonymous responses for active surveys"
  ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (
    respondent_email IS NULL
    AND (public.has_role(auth.uid(), 'user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    AND EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_responses.survey_id AND s.active = true)
  );