CREATE OR REPLACE FUNCTION public.is_contribution_exempt_shop(_member_id integer, _naam text, _plaats text, _year integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.contribution_exemptions e
    WHERE e.year = _year
      AND (
        e.member_id = _member_id
        OR e.member_id IN (SELECT f.member_id FROM public.find_shop_match(_naam, _plaats) f)
      )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_contribution_exempt_shop(integer, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_contribution_exempt_shop(integer, text, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_prepare_invoice_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  IF NEW.member_type <> 'member' THEN
    RETURN NULL;
  END IF;

  IF public.is_contribution_exempt_shop(
       NEW.id,
       NEW.data->>'naam',
       NEW.data->>'plaats',
       EXTRACT(YEAR FROM now())::int
     ) THEN
    RAISE NOTICE 'Lid % is vrijgesteld van contributie dit jaar: geen factuur aangemaakt', NEW.id;
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET' LIMIT 1;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;

  IF v_secret IS NULL OR v_url IS NULL THEN
    RAISE NOTICE 'Informer-sync niet aangeroepen: ontbrekende configuratie';
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/informer-sync?action=prepare_invoices&member_id=' || NEW.id,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    body := '{}'::jsonb
  );

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_todo_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.member_type <> 'member' THEN
    RETURN NULL;
  END IF;

  IF public.is_contribution_exempt_shop(
       NEW.id,
       NEW.data->>'naam',
       NEW.data->>'plaats',
       EXTRACT(YEAR FROM now())::int
     ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.finance_todos (member_id, year, todo_type, title, status)
  VALUES (
    NEW.id,
    EXTRACT(YEAR FROM now())::int,
    'new_member_invoice',
    'Contributiefactuur opstellen voor nieuw lid ' || coalesce(NEW.data->>'naam', NEW.id::text),
    'open'
  )
  ON CONFLICT DO NOTHING;

  RETURN NULL;
END;
$function$;