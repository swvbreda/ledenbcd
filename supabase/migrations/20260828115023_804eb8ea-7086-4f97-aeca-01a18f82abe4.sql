ALTER TABLE public.coffeeshop_register_sync_state
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_trigger text;

CREATE OR REPLACE FUNCTION public.trigger_register_enrichment_scoped(
  _member_id integer DEFAULT NULL,
  _register_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NOT NULL
     AND NOT public.has_role(uid, 'admin'::app_role)
     AND NOT public.is_board_member(uid) THEN
    RAISE EXCEPTION 'Only admins or board members can trigger the enrichment' USING ERRCODE = '42501';
  END IF;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/enrich-members-from-register',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := jsonb_strip_nulls(jsonb_build_object('member_id', _member_id, 'register_id', _register_id))
  ) INTO req_id;

  RETURN req_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_register_enrichment_scoped(integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.trigger_register_enrichment_scoped(integer, uuid) TO authenticated;