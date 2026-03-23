
-- Surveys table
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active surveys" ON public.surveys
  FOR SELECT TO authenticated
  USING (active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert surveys" ON public.surveys
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update surveys" ON public.surveys
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete surveys" ON public.surveys
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Survey questions
CREATE TABLE public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'text',
  options jsonb DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read survey questions" ON public.survey_questions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert survey questions" ON public.survey_questions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update survey questions" ON public.survey_questions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete survey questions" ON public.survey_questions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Anonymous responses (NO user_id!)
CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert responses" ON public.survey_responses
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read responses" ON public.survey_responses
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Completion tracking (prevents double submission)
CREATE TABLE public.survey_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, user_id)
);

ALTER TABLE public.survey_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own completions" ON public.survey_completions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own completion" ON public.survey_completions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
