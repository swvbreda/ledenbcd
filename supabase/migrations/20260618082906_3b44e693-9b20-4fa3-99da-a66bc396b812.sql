
CREATE TABLE public.outlook_sync_log (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  trigger text,
  details jsonb default '{}'::jsonb
);

GRANT SELECT ON public.outlook_sync_log TO authenticated;
GRANT ALL ON public.outlook_sync_log TO service_role;
ALTER TABLE public.outlook_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view outlook sync log"
  ON public.outlook_sync_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX outlook_sync_log_started_at_idx ON public.outlook_sync_log (started_at DESC);

-- Trigger function to fire sync on member changes (fire-and-forget)
CREATE OR REPLACE FUNCTION public.notify_outlook_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/sync-outlook-contacts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YmZkcnJpd2F5bmZldXJxa2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTY4OTcsImV4cCI6MjA4OTQzMjg5N30.QmhhJBydIvy_-bcjLqOWsgJGmJr-CZa3gDCDMHNkey8'
    ),
    body := jsonb_build_object('trigger', TG_OP || ':members_data')
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER members_data_outlook_sync
AFTER INSERT OR UPDATE OR DELETE ON public.members_data
FOR EACH STATEMENT EXECUTE FUNCTION public.notify_outlook_sync();
