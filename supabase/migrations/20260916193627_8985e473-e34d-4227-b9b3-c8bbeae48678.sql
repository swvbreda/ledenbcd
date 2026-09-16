DROP POLICY IF EXISTS "Leden zien gelieerde leden" ON public.member_affiliations;

CREATE POLICY "Gelieerde leden zichtbaar voor bestuur of eigen lid"
ON public.member_affiliations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_board_member(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.member_profiles mp
    WHERE mp.user_id = auth.uid()
      AND (mp.member_id = member_affiliations.member_id
           OR mp.member_id = member_affiliations.related_member_id)
  )
);