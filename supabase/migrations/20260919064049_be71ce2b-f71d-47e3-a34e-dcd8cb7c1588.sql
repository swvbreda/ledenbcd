-- 1. Jaargebonden contributievrijstelling
CREATE TABLE IF NOT EXISTS public.contribution_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  year integer NOT NULL,
  reason text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (member_id, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contribution_exemptions TO authenticated;
GRANT ALL ON public.contribution_exemptions TO service_role;

ALTER TABLE public.contribution_exemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beheer en bestuur zien vrijstellingen"
ON public.contribution_exemptions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_board_member(auth.uid())
  OR member_id IN (SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid())
);

CREATE POLICY "Alleen beheer beheert vrijstellingen"
ON public.contribution_exemptions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Alleen beheer wijzigt vrijstellingen"
ON public.contribution_exemptions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Alleen beheer verwijdert vrijstellingen"
ON public.contribution_exemptions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Guard-functie: is dit lid vrijgesteld voor dit contributiejaar?
CREATE OR REPLACE FUNCTION public.is_contribution_exempt(_member_id integer, _year integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contribution_exemptions
    WHERE member_id = _member_id AND year = _year
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_contribution_exempt(integer, integer) TO authenticated, service_role;

-- 3. Naam-normalisatie voor dedupliceren van aanmeldingen
CREATE OR REPLACE FUNCTION public.normalize_shop_naam(_naam text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(translate(coalesce(_naam, ''), 'áàâäãåéèêëíìîïóòôöõúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')),
      '\m(coffeeshop|koffieshop|coffee shop|shop|de|het|the|bv|b\.v\.)\M', ' ', 'g'
    ),
    '[^a-z0-9]', '', 'g'
  );
$$;

-- 4. Facturatietriggers respecteren de vrijstelling van het betreffende jaar
CREATE OR REPLACE FUNCTION public.auto_prepare_invoice_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer := (EXTRACT(year FROM now()))::integer;
BEGIN
  IF NEW.member_type = 'member' THEN
    IF public.is_contribution_exempt(NEW.id, v_year) THEN
      RAISE NOTICE 'Lid % is vrijgesteld voor %, geen factuur klaargezet', NEW.id, v_year;
      RETURN NULL;
    END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.auto_todo_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer := (EXTRACT(year FROM now()))::integer;
BEGIN
  IF NEW.member_type = 'member' AND NOT public.is_contribution_exempt(NEW.id, v_year) THEN
    INSERT INTO public.finance_todos (todo_type, title, description, assigned_to, member_id, year)
    VALUES (
      'new_member_invoice',
      'Factuur aanmaken voor nieuw lid #' || NEW.id,
      'Lid #' || NEW.id || ' (' || COALESCE(NEW.data->>'naam', 'Onbekend') || ') is toegevoegd. Er moet een contributiefactuur worden aangemaakt.',
      'secretariaat',
      NEW.id,
      v_year
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Webaanmelding koppelt aan een bestaande shop in plaats van een duplicaat aan te maken
ALTER TABLE public.membership_requests ADD COLUMN IF NOT EXISTS matched_member_id integer;
ALTER TABLE public.membership_requests ADD COLUMN IF NOT EXISTS match_status text;

CREATE OR REPLACE FUNCTION public.find_shop_match(_naam text, _plaats text)
RETURNS TABLE(member_id integer, member_type text, naam text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.member_type, m.data->>'naam'
  FROM public.members_data m
  WHERE m.member_type IN ('member', 'lead')
    AND m.id < 10000
    AND public.normalize_shop_naam(m.data->>'naam') <> ''
    AND public.normalize_shop_naam(m.data->>'naam') = public.normalize_shop_naam(_naam)
    AND public.normalize_shop_naam(coalesce(m.data->>'plaats', '')) = public.normalize_shop_naam(coalesce(_plaats, ''))
  ORDER BY m.id
  LIMIT 2;
$$;

GRANT EXECUTE ON FUNCTION public.find_shop_match(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_create_member_from_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id integer;
  clean_email text;
  clean_phone text;
  clean_name text;
  clean_shop text;
  clean_city text;
  data_json jsonb;
  v_type text;
  v_match_count integer;
  v_match_id integer;
BEGIN
  clean_email := lower(trim(coalesce(NEW.email, '')));
  clean_phone := trim(coalesce(NEW.phone, ''));
  clean_name := trim(coalesce(NEW.full_name, ''));
  clean_shop := trim(coalesce(NEW.coffeeshop_name, ''));
  clean_city := trim(coalesce(NEW.city, ''));
  v_type := CASE WHEN NEW.request_type = 'lead' THEN 'lead' ELSE 'member' END;

  IF clean_shop = '' THEN
    RETURN NEW;
  END IF;

  -- Bestaat deze shop al (voorgeregistreerd of eerder aangemeld)? Dan geen
  -- tweede record aanmaken en geen inlogtoegang geven: handmatig beoordelen.
  SELECT count(*), min(fm.member_id) INTO v_match_count, v_match_id
  FROM public.find_shop_match(clean_shop, clean_city) fm;

  IF v_match_count = 1 THEN
    NEW.matched_member_id := v_match_id;
    NEW.match_status := 'matched';
    RETURN NEW;
  ELSIF v_match_count > 1 THEN
    NEW.match_status := 'review';
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(id), 0) + 1 INTO new_id FROM public.members_data WHERE id < 10000;

  data_json := jsonb_build_object(
    'id', new_id,
    'naam', clean_shop,
    'bedrijfsnaam', clean_shop,
    'plaats', clean_city,
    'stadsdeel', '',
    'contactpersoon', clean_name,
    'functie', '',
    'telefoon', clean_phone,
    'email', clean_email,
    'oprichtingJaar', null,
    'jarenLid', null,
    'lidSinds', CASE WHEN v_type = 'member' THEN EXTRACT(year FROM now())::int ELSE null END,
    'aantalLocaties', 1,
    'locaties', jsonb_build_array(
      jsonb_build_object('naam', clean_shop, 'plaats', clean_city, 'adres', '', 'postcode', '')
    ),
    'factuurBedrijfsnaam', clean_shop,
    'factuurPlaats', clean_city,
    'factuurEmail', clean_email,
    'factuurTelefoon', clean_phone,
    'contacten', jsonb_build_array(
      jsonb_build_object('naam', clean_name, 'functie', '', 'email', clean_email, 'telefoon', clean_phone)
    )
  );

  INSERT INTO public.members_data (id, member_type, data)
  VALUES (new_id, v_type, data_json);

  NEW.matched_member_id := new_id;
  NEW.match_status := 'created';

  IF clean_email <> '' AND v_type = 'member' THEN
    BEGIN
      INSERT INTO public.member_allowed_emails (member_id, email) VALUES (new_id, clean_email);
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
      INSERT INTO public.member_mailing_preferences (member_id, email) VALUES (new_id, clean_email);
    EXCEPTION WHEN unique_violation THEN NULL; END;
  END IF;

  -- Belangrijk: status NIET overschrijven, zodat de aanmelding zichtbaar
  -- blijft in de Goedkeuringen-lijst totdat het bestuur ze markeert.
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_create_member_from_request failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;