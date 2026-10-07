ALTER TABLE public.internal_declarations DROP CONSTRAINT IF EXISTS internal_declarations_informer_status_check;
ALTER TABLE public.internal_declarations ADD CONSTRAINT internal_declarations_informer_status_check
  CHECK (informer_status IN ('not_sent', 'queued', 'sending', 'sent', 'synced', 'error'));
COMMENT ON COLUMN public.internal_declarations.informer_external_id IS 'Informer document-id van het inkoopdocument';
COMMENT ON COLUMN public.internal_declarations.informer_synced_at IS 'Laatste succesvolle sync (last_sync_at)';
COMMENT ON COLUMN public.internal_declarations.informer_error IS 'Laatste syncfout (sync_error), zonder IBAN';