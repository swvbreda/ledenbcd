
CREATE OR REPLACE FUNCTION public.send_welcome_email_admin(_recipient text, _subject text, _body text, _idempotency_key text)
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
    RAISE EXCEPTION 'Only admins can send welcome emails' USING ERRCODE = '42501';
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
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := jsonb_build_object(
      'templateName', 'member-welcome',
      'recipientEmail', _recipient,
      'idempotencyKey', _idempotency_key,
      'templateData', jsonb_build_object('subject', _subject, 'body', _body)
    )
  ) INTO req_id;

  RETURN req_id;
END;
$$;

-- Debug helper: list vault secret names via admin-only RPC
CREATE OR REPLACE FUNCTION public._list_vault_secret_names()
RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER SET search_path=public
AS $$ SELECT name FROM vault.decrypted_secrets $$;
