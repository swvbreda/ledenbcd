-- Shared images remain available to their intended portal readers.
-- Direct Storage listing/signing must not be available to every signed-in account.
-- Existing public logo and agenda-share adapters keep their separate, narrow contracts.
BEGIN;

ALTER POLICY "Authenticated can view agenda images"
ON storage.objects
USING (
  bucket_id = 'agenda-images'
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      (
        public.is_board_member((SELECT auth.uid()))
        OR (SELECT public.support_my_member_id()) IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM public.agenda_events event
        WHERE event.image_path = objects.name
          AND event.is_published
      )
    )
  )
);

COMMENT ON POLICY "Authenticated can view agenda images" ON storage.objects
IS 'Admins can preview uploads. Other board or linked portal readers can read only images referenced by published agenda events visible under their existing event RLS.';

ALTER POLICY "member logos readable by authenticated"
ON storage.objects
USING (
  bucket_id = 'member-logos'
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.is_board_member((SELECT auth.uid()))
    OR (
      (SELECT public.support_my_member_id()) IS NOT NULL
      AND array_length(storage.foldername(name), 1) = 1
      AND (storage.foldername(name))[1] ~ '^[0-9]+$'
      AND storage.filename(name) LIKE 'logo.%'
    )
  )
);

COMMENT ON POLICY "member logos readable by authenticated" ON storage.objects
IS 'Admins and board retain media management. Linked portal readers share only memberId/logo.* objects; external, hired and unlinked accounts have no direct bucket read. Public logo adapters are unchanged.';

COMMIT;
