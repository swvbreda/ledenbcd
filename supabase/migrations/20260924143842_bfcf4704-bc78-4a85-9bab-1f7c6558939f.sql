CREATE OR REPLACE FUNCTION public.auto_prepare_invoice_new_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF NEW.member_type <> 'member' THEN
    RETURN NULL;
  END IF;

  IF public.is_contribution_exempt_shop(NEW.id, NEW.data->>'naam', NEW.data->>'plaats', EXTRACT(YEAR FROM now())::int) THEN
    RAISE NOTICE 'Lid % is vrijgesteld van contributie dit jaar: geen factuur aangemaakt', NEW.id;
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'internal_webhook_secret' LIMIT 1;

  IF v_secret IS NULL THEN
    INSERT INTO public.finance_todos (todo_type, title, status, reference_id)
    SELECT 'new_member_invoice', 'Factuur handmatig klaarzetten voor lid #' || NEW.id || ' (koppeling niet geconfigureerd)', 'pending', NEW.id::text
    WHERE false; -- alleen melden via notice; todo wordt al door auto_todo_new_member aangemaakt
    RAISE WARNING 'Informer-factuur niet gestart voor lid %: interne sleutel ontbreekt', NEW.id;
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := 'https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/informer-sync?action=prepare_invoices&member_id=' || NEW.id,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );

  RETURN NULL;
END;
$function$;