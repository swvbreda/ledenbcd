
CREATE OR REPLACE FUNCTION public.set_vault_secret(_name text, _value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = _name;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(_value, _name);
  ELSE
    PERFORM vault.update_secret(existing_id, _value);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_vault_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_vault_secret(text, text) TO service_role;
