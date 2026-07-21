
-- Grant Data API access
GRANT INSERT ON public.membership_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_requests TO authenticated;
GRANT ALL ON public.membership_requests TO service_role;

-- Drop and recreate policies to ensure consistent state
DROP POLICY IF EXISTS "Anyone can submit membership request" ON public.membership_requests;
DROP POLICY IF EXISTS "Admins can view all membership requests" ON public.membership_requests;
DROP POLICY IF EXISTS "Admins can update membership requests" ON public.membership_requests;
DROP POLICY IF EXISTS "Admins can delete membership requests" ON public.membership_requests;

-- Anyone (also anonymous) can submit a membership request
CREATE POLICY "Anyone can submit membership request"
  ON public.membership_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins and board members can view/manage requests
CREATE POLICY "Admins can view all membership requests"
  ON public.membership_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins can update membership requests"
  ON public.membership_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_board_member(auth.uid()));

CREATE POLICY "Admins can delete membership requests"
  ON public.membership_requests
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
