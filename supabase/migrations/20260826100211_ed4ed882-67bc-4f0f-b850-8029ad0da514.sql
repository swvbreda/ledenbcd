
CREATE OR REPLACE FUNCTION public.member_registered_emails(_member_id integer)
RETURNS TABLE(email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH src AS (
    SELECT COALESCE(md.data, '{}'::jsonb) AS base, COALESCE(me.data, '{}'::jsonb) AS overlay, md.member_type
    FROM public.members_data md
    LEFT JOIN public.member_edits me ON me.member_id = md.id
    WHERE md.id = _member_id
  ),
  raw AS (
    SELECT src.base->>'email' AS v FROM src
    UNION ALL SELECT src.overlay->>'email' FROM src
    UNION ALL SELECT src.base->>'factuurEmail' FROM src
    UNION ALL SELECT src.overlay->>'factuurEmail' FROM src
    UNION ALL SELECT c->>'email' FROM src, jsonb_array_elements(
      CASE WHEN jsonb_typeof(src.base->'contacten') = 'array' THEN src.base->'contacten' ELSE '[]'::jsonb END) c
    UNION ALL SELECT c->>'email' FROM src, jsonb_array_elements(
      CASE WHEN jsonb_typeof(src.overlay->'contacten') = 'array' THEN src.overlay->'contacten' ELSE '[]'::jsonb END) c
  ),
  split AS (
    SELECT lower(btrim(part)) AS email
    FROM raw, LATERAL regexp_split_to_table(COALESCE(raw.v, ''), '[,;/\s]+') AS part
  )
  SELECT DISTINCT s.email
  FROM split s, src
  WHERE s.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND src.member_type = 'member';
$$;

CREATE OR REPLACE FUNCTION public.sync_member_allowed_emails(_member_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nieuwe adressen toegang geven
  INSERT INTO public.member_allowed_emails (member_id, email)
  SELECT _member_id, e.email FROM public.member_registered_emails(_member_id) e
  ON CONFLICT DO NOTHING;

  -- Verwijderde adressen intrekken
  DELETE FROM public.member_allowed_emails a
  WHERE a.member_id = _member_id
    AND a.email NOT IN (SELECT email FROM public.member_registered_emails(_member_id));

  -- Bestaande accounts van ingetrokken adressen loskoppelen van dit lid
  DELETE FROM public.member_profiles p
  WHERE p.member_id = _member_id
    AND NOT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = p.user_id
        AND lower(u.email) IN (SELECT email FROM public.member_registered_emails(_member_id))
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_member_allowed_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id integer;
BEGIN
  IF TG_TABLE_NAME = 'members_data' THEN
    v_member_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_member_id := COALESCE(NEW.member_id, OLD.member_id);
  END IF;

  BEGIN
    PERFORM public.sync_member_allowed_emails(v_member_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_member_allowed_emails failed for %: %', v_member_id, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_data_sync_emails ON public.members_data;
CREATE TRIGGER trg_members_data_sync_emails
AFTER INSERT OR UPDATE ON public.members_data
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_member_allowed_emails();

DROP TRIGGER IF EXISTS trg_member_edits_sync_emails ON public.member_edits;
CREATE TRIGGER trg_member_edits_sync_emails
AFTER INSERT OR UPDATE OR DELETE ON public.member_edits
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_member_allowed_emails();

REVOKE EXECUTE ON FUNCTION public.member_registered_emails(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_member_allowed_emails(integer) FROM anon, authenticated;
