DROP POLICY IF EXISTS "Ingelogde gebruikers kunnen aliassen lezen" ON public.member_shop_aliases;
DROP POLICY IF EXISTS "Bestuur en beheer lezen shop-aliassen" ON public.member_shop_aliases;
CREATE POLICY "Bestuur en beheer lezen shop-aliassen"
ON public.member_shop_aliases FOR SELECT TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role)
  OR public.is_board_member((SELECT auth.uid()))
);