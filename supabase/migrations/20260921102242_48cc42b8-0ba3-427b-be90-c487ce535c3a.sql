DROP POLICY IF EXISTS "Board members can read all members_data" ON public.members_data;
CREATE POLICY "Board members can read all members_data"
ON public.members_data
FOR SELECT
TO authenticated
USING (public.is_board_member((select auth.uid())));