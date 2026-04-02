CREATE POLICY "Authenticated users can read all members_data"
ON public.members_data
FOR SELECT
TO authenticated
USING (true);