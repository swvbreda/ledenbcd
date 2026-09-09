CREATE OR REPLACE FUNCTION public.trigger_prepare_contribution_invoices(_member_id integer DEFAULT NULL::integer, _dry_run boolean DEFAULT false)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  req_id bigint;
  uid uuid := auth.uid();
  q text := '';
BEGIN
  IF uid IS NOT NULL
     AND NOT public.has_role(uid, 'admin'::app_role)
     AND NOT public.is_board_member(uid) THEN
    RAISE EXCEPTION 'Alleen bestuur of beheerders kunnen facturen klaarzetten' USING ERRCODE = '42501';
  END IF;

  IF _member_id IS NOT NULL THEN
    q := q || '&member_id=' || _member_id::text;
  END IF;
  IF _dry_run THEN
    q := q || '&dry_run=1';
  END IF;

  SELECT net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/informer-sync?action=prepare_invoices' || q,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_prepare_contribution_invoices(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_prepare_contribution_invoices(integer, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_prepare_invoice_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.member_type = 'member' THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/informer-sync?action=prepare_invoices&member_id=' || NEW.id::text,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret')
        ),
        body := '{}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_prepare_invoice_new_member failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_prepare_invoice_new_member ON public.members_data;
CREATE TRIGGER trg_auto_prepare_invoice_new_member
AFTER INSERT ON public.members_data
FOR EACH ROW EXECUTE FUNCTION public.auto_prepare_invoice_new_member();