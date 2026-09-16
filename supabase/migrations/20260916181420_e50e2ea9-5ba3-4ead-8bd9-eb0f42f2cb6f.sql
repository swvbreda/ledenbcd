ALTER TABLE public.coffeeshop_register
  ADD COLUMN IF NOT EXISTS web_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS logo_bron text;

CREATE OR REPLACE FUNCTION public.trigger_register_shop_enrichment(_only_members boolean DEFAULT false)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NOT NULL AND NOT public.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can trigger the enrichment' USING ERRCODE = '42501';
  END IF;

  SELECT net.http_post(
    url := 'https://leden.coffeeshopbond.nl/api/public/register-enrich',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := jsonb_build_object('only_members', coalesce(_only_members, false)),
    timeout_milliseconds := 120000
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_register_shop_enrichment(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_register_shop_enrichment(boolean) TO authenticated, service_role;

SELECT cron.schedule(
  'register-shop-enrichment-nightly',
  '40 3 * * *',
  $$select public.trigger_register_shop_enrichment(false);$$
);

SELECT cron.schedule(
  'register-member-enrichment-nightly',
  '55 3 * * *',
  $$select public.trigger_register_enrichment();$$
);