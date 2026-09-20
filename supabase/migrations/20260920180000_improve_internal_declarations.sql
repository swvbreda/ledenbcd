-- Declaraties: vaste koppeling met een bestuurslid, veilige bonopslag en
-- traceerbare verwerking richting Informer.
ALTER TABLE public.internal_declarations
  ADD COLUMN IF NOT EXISTS board_member_id uuid REFERENCES public.board_members(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS informer_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS informer_external_id text,
  ADD COLUMN IF NOT EXISTS informer_error text,
  ADD COLUMN IF NOT EXISTS informer_synced_at timestamptz;

ALTER TABLE public.internal_declarations
  DROP CONSTRAINT IF EXISTS internal_declarations_informer_status_check;
ALTER TABLE public.internal_declarations
  ADD CONSTRAINT internal_declarations_informer_status_check
  CHECK (informer_status IN ('not_sent', 'queued', 'synced', 'error'));

CREATE INDEX IF NOT EXISTS internal_declarations_board_member_idx
  ON public.internal_declarations(board_member_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS internal_declarations_informer_queue_idx
  ON public.internal_declarations(informer_status, created_at)
  WHERE informer_status IN ('queued', 'error');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'declaration-receipts',
  'declaration-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Declaranten uploaden eigen bonnen" ON storage.objects;
CREATE POLICY "Declaranten uploaden eigen bonnen"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'declaration-receipts'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Declaranten lezen eigen bonnen" ON storage.objects;
CREATE POLICY "Declaranten lezen eigen bonnen"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'declaration-receipts'
  AND (
    owner_id = (SELECT auth.uid())::text
    OR public.has_role((SELECT auth.uid()), 'admin')
  )
);

DROP POLICY IF EXISTS "Declaranten verwijderen eigen bonnen" ON storage.objects;
CREATE POLICY "Declaranten verwijderen eigen bonnen"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'declaration-receipts'
  AND (
    owner_id = (SELECT auth.uid())::text
    OR public.has_role((SELECT auth.uid()), 'admin')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_declarations TO authenticated;
