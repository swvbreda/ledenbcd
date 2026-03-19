
-- Fix 1: lead_conversions - restrict SELECT to owner or admin
DROP POLICY IF EXISTS "Authenticated users can read lead conversions" ON public.lead_conversions;

CREATE POLICY "Users can read own or admin can read all lead conversions"
  ON public.lead_conversions FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Fix 2: member_edits - restrict SELECT to own member or admin
DROP POLICY IF EXISTS "Authenticated users can read member edits" ON public.member_edits;

CREATE POLICY "Users can read own or admin can read all member edits"
  ON public.member_edits FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
