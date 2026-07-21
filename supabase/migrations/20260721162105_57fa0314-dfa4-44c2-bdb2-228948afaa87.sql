
-- Function: auto-create member on new membership_requests insert
CREATE OR REPLACE FUNCTION public.auto_create_member_from_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id integer;
  clean_email text;
  clean_phone text;
  clean_name text;
  clean_shop text;
  clean_city text;
  data_json jsonb;
BEGIN
  clean_email := lower(trim(coalesce(NEW.email, '')));
  clean_phone := trim(coalesce(NEW.phone, ''));
  clean_name := trim(coalesce(NEW.full_name, ''));
  clean_shop := trim(coalesce(NEW.coffeeshop_name, ''));
  clean_city := trim(coalesce(NEW.city, ''));

  IF clean_shop = '' THEN
    -- Not enough info: leave as-is (status 'new') for manual review
    RETURN NEW;
  END IF;

  -- Next available id across all members_data rows (members, leads, oud-leden)
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
    'lidSinds', EXTRACT(year FROM now())::int,
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
  VALUES (new_id, 'member', data_json);

  IF clean_email <> '' THEN
    BEGIN
      INSERT INTO public.member_allowed_emails (member_id, email)
      VALUES (new_id, clean_email);
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO public.member_mailing_preferences (member_id, email)
      VALUES (new_id, clean_email);
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END IF;

  -- Mark request as automatically approved
  NEW.status := 'approved';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert on failure; keep as 'new' for manual handling
  RAISE WARNING 'auto_create_member_from_request failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- BEFORE INSERT trigger to auto-create member and set status
DROP TRIGGER IF EXISTS before_insert_membership_request_autocreate ON public.membership_requests;
CREATE TRIGGER before_insert_membership_request_autocreate
BEFORE INSERT ON public.membership_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_member_from_request();

-- AFTER INSERT trigger: send admin notification email (re-attach existing function)
DROP TRIGGER IF EXISTS after_insert_membership_request_notify ON public.membership_requests;
CREATE TRIGGER after_insert_membership_request_notify
AFTER INSERT ON public.membership_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_membership_request();
