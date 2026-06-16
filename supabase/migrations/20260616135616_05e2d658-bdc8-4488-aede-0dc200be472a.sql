
-- Restrict survey creation/modification to admins to prevent member email harvesting.

DROP POLICY IF EXISTS "Users can insert surveys" ON public.surveys;
DROP POLICY IF EXISTS "Users can update own surveys" ON public.surveys;
DROP POLICY IF EXISTS "Users can delete own surveys" ON public.surveys;

DROP POLICY IF EXISTS "Users can insert survey questions for own surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Users can update survey questions for own surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Users can delete survey questions for own surveys" ON public.survey_questions;

DROP POLICY IF EXISTS "Users can read responses for own surveys" ON public.survey_responses;
