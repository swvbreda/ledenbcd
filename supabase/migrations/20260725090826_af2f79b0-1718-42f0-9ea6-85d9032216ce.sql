CREATE OR REPLACE FUNCTION public.trigger_informer_sync(_action text DEFAULT 'all')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
  svc_key text;
BEGIN
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger informer sync' USING ERRCODE = '42501';
  END IF;

  SELECT decrypted_secret INTO svc_key
  FROM vault.decrypted_secrets
  WHERE name IN ('supabase_service_role_key','service_role_key','SUPABASE_SERVICE_ROLE_KEY','email_queue_service_role_key')
  ORDER BY CASE name
    WHEN 'supabase_service_role_key' THEN 1
    WHEN 'SUPABASE_SERVICE_ROLE_KEY' THEN 2
    WHEN 'service_role_key' THEN 3
    ELSE 9
  END
  LIMIT 1;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/informer-sync?action=' || _action,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_informer_sync(text) TO authenticated, service_role;

-- Remove empty placeholder invoice for member 138 so Informer sync inserts the real one
DELETE FROM public.contribution_invoices
WHERE member_id = 138
  AND year = 2026
  AND (invoice_number IS NULL OR invoice_number = '');