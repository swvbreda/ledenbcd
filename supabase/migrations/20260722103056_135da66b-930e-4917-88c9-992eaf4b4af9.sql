ALTER TABLE public.informer_sync_log
  ADD COLUMN IF NOT EXISTS api_calls jsonb;