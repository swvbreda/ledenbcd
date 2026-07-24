
CREATE OR REPLACE FUNCTION public.send_welcome_email_admin(_recipient text, _subject text, _body text, _idempotency_key text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
BEGIN
  -- Allow either server-side calls (no JWT) or authenticated admins.
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can send welcome emails' USING ERRCODE = '42501';
  END IF;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
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
