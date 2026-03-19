CREATE POLICY "Authenticated users can read member edits"
ON public.member_edits
FOR SELECT
TO authenticated
USING (true);