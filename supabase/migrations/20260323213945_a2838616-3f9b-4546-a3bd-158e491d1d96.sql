
-- Allow anonymous users to insert survey responses (for external survey link)
CREATE POLICY "Anon can insert responses"
ON public.survey_responses FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to read survey questions
CREATE POLICY "Anon can read survey questions"
ON public.survey_questions FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to read active surveys
CREATE POLICY "Anon can read active surveys"
ON public.surveys FOR SELECT
TO anon
USING (active = true);
