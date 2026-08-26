
CREATE OR REPLACE FUNCTION public.can_manage_member_media(_user_id uuid, _member_folder text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.is_board_member(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE mp.user_id = _user_id
        AND _member_folder ~ '^[0-9]+$'
        AND mp.member_id = _member_folder::integer
    )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_member_media(uuid, text) FROM anon;

CREATE POLICY "member media readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('contact-photos', 'member-logos'));

CREATE POLICY "member media insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('contact-photos', 'member-logos')
  AND public.can_manage_member_media(auth.uid(), (storage.foldername(name))[1])
);

CREATE POLICY "member media update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('contact-photos', 'member-logos')
  AND public.can_manage_member_media(auth.uid(), (storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id IN ('contact-photos', 'member-logos')
  AND public.can_manage_member_media(auth.uid(), (storage.foldername(name))[1])
);

CREATE POLICY "member media delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('contact-photos', 'member-logos')
  AND public.can_manage_member_media(auth.uid(), (storage.foldername(name))[1])
);
