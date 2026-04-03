-- Allow all authenticated users to read member_edits (same visibility as members_data)
CREATE POLICY "Authenticated users can read all member edits"
ON public.member_edits
FOR SELECT
TO authenticated
USING (true);
