
DROP POLICY IF EXISTS "member media insert" ON storage.objects;
DROP POLICY IF EXISTS "member media update" ON storage.objects;
DROP POLICY IF EXISTS "member media delete" ON storage.objects;
DROP FUNCTION IF EXISTS public.can_manage_member_media(uuid, text);

CREATE POLICY "member media insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('contact-photos', 'member-logos')
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_board_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE mp.user_id = auth.uid()
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND mp.member_id = ((storage.foldername(name))[1])::integer
    )
  )
);

CREATE POLICY "member media update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('contact-photos', 'member-logos')
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_board_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE mp.user_id = auth.uid()
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND mp.member_id = ((storage.foldername(name))[1])::integer
    )
  )
);

CREATE POLICY "member media delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('contact-photos', 'member-logos')
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_board_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE mp.user_id = auth.uid()
        AND (storage.foldername(name))[1] ~ '^[0-9]+$'
        AND mp.member_id = ((storage.foldername(name))[1])::integer
    )
  )
);
