
-- Helper function: check if user is the PCN reviewer
CREATE OR REPLACE FUNCTION public.is_pcn_reviewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND email = 'info@platformcannabis.nl'
  )
$$;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Users can read external pending responses" ON public.survey_responses;
DROP POLICY IF EXISTS "PCN reviewer can update external response status" ON public.survey_responses;

-- New SELECT: PCN reviewer can read ALL external responses (not just pending)
CREATE POLICY "PCN reviewer can read external responses"
ON public.survey_responses
FOR SELECT
TO authenticated
USING (
  respondent_email IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR is_pcn_reviewer(auth.uid()))
);

-- New UPDATE: only admin or PCN reviewer can update external responses
CREATE POLICY "PCN reviewer can update external response status"
ON public.survey_responses
FOR UPDATE
TO authenticated
USING (
  respondent_email IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR is_pcn_reviewer(auth.uid()))
)
WITH CHECK (
  respondent_email IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR is_pcn_reviewer(auth.uid()))
);
