CREATE OR REPLACE FUNCTION public.member_registered_emails(_member_id integer)
 RETURNS TABLE(email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Eenmalige aanvulling: bestaande leden krijgen hun factuuradres (weer) als toegestaan adres.
-- sync_member_allowed_emails is insert-only en verwijdert niets.
DO $$
DECLARE m RECORD;
BEGIN
  FOR m IN SELECT id FROM public.members_data WHERE member_type = 'member' LOOP
    PERFORM public.sync_member_allowed_emails(m.id);
  END LOOP;
END $$;