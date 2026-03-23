
-- Add status and respondent_email to survey_responses for PCN approval workflow
ALTER TABLE public.survey_responses 
  ADD COLUMN status text NOT NULL DEFAULT 'approved',
  ADD COLUMN respondent_email text;

-- Update RLS: PCN reviewer (user role) can read external responses for surveys they need to review
-- We'll handle PCN access through a specific check in the app
