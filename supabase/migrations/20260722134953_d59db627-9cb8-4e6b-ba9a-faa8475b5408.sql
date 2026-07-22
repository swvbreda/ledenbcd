CREATE OR REPLACE FUNCTION public.replay_membership_notify(_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  req_id bigint;
  r public.membership_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.membership_requests WHERE id = _id;
  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/notify-membership-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := jsonb_build_object(
      'type','INSERT',
      'record', jsonb_build_object(
        'id', r.id,
        'full_name', r.full_name,
        'email', r.email,
        'coffeeshop_name', r.coffeeshop_name,
        'city', r.city,
        'phone', r.phone,
        'message', r.message,
        'request_type', r.request_type
      )
    )
  ) INTO req_id;
  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_membership_notify(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_membership_notify(uuid) TO service_role;