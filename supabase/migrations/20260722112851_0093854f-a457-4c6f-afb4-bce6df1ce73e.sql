
ALTER TABLE public.membership_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'member'
    CHECK (request_type IN ('member','lead'));

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

  SELECT COALESCE(MAX(id), 0) + 1 INTO new_id FROM public.members_data;

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

  IF clean_email <> '' AND v_type = 'member' THEN
    BEGIN
      INSERT INTO public.member_allowed_emails (member_id, email) VALUES (new_id, clean_email);
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
      INSERT INTO public.member_mailing_preferences (member_id, email) VALUES (new_id, clean_email);
    EXCEPTION WHEN unique_violation THEN NULL; END;
  END IF;

  NEW.status := 'approved';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_create_member_from_request failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;
