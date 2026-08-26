DROP POLICY IF EXISTS "Service can insert profiles" ON public.member_profiles;

CREATE POLICY "Users can link own verified member"
ON public.member_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.member_allowed_emails mae
      JOIN auth.users u ON u.id = auth.uid()
      WHERE mae.member_id = member_profiles.member_id
        AND mae.email = lower(trim(u.email))
    )
  )
);