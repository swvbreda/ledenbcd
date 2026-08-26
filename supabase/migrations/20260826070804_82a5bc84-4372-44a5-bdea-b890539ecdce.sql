CREATE OR REPLACE FUNCTION public.normalize_gemeente(_naam text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v text := btrim(COALESCE(_naam, ''));
  v_reg text;
BEGIN
  IF v = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Exacte gemeentenaam in het register? Dan is het al een gemeente.
  IF EXISTS (
    SELECT 1 FROM public.coffeeshop_register r
    WHERE lower(btrim(r.gemeente)) = lower(v)
  ) THEN
    RETURN v;
  END IF;

  -- 2. Bekend als plaats in het register? Neem de bijbehorende gemeente.
  SELECT NULLIF(btrim(r.gemeente), '') INTO v_reg
  FROM public.coffeeshop_register r
  WHERE lower(btrim(r.plaats)) = lower(v)
    AND NULLIF(btrim(r.gemeente), '') IS NOT NULL
  LIMIT 1;
  IF v_reg IS NOT NULL THEN
    RETURN v_reg;
  END IF;

  -- 3. Vaste vertaallijst voor plaatsen zonder eigen registervermelding.
  RETURN CASE lower(v)
    WHEN 'wormerveer' THEN 'Zaanstad'
    WHEN 'zaandam' THEN 'Zaanstad'
    WHEN 'wormer' THEN 'Zaanstad'
    WHEN 'krommenie' THEN 'Zaanstad'
    WHEN 'assendelft' THEN 'Zaanstad'
    WHEN 'hellevoetsluis' THEN 'Voorne aan Zee'
    WHEN 'brielle' THEN 'Voorne aan Zee'
    WHEN 'westvoorne' THEN 'Voorne aan Zee'
    WHEN 'hoogezand' THEN 'Midden-Groningen'
    WHEN 'bussum' THEN 'Gooise Meren'
    WHEN 'driebergen' THEN 'Utrechtse Heuvelrug'
    WHEN 'driebergen-rijsenburg' THEN 'Utrechtse Heuvelrug'
    WHEN 'mijdrecht' THEN 'De Ronde Venen'
    WHEN 'steenwijk' THEN 'Steenwijkerland'
    ELSE v
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_gemeente(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_gemeente(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_representation_stats()
 RETURNS TABLE(gemeente text, landelijke_shops integer, vertegenwoordigde_shops integer, gekoppelde_registershops integer, niet_gekoppelde_locaties integer, koppelingen_zonder_vestiging integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH active_register AS (
  SELECT r.id, COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) AS gemeente
  FROM public.coffeeshop_register r WHERE r.vervallen = false
    AND COALESCE((r.raw->>'is_ruis')::boolean, false) = false
    AND lower(COALESCE(r.status, '')) <> 'gesloten' AND COALESCE(r.raw->>'gesloten_op', '') = ''
),
confirmed AS (
  SELECT DISTINCT ON (l.register_id) l.register_id, l.member_id, NULLIF(btrim(l.location_key), '') AS location_key, ar.gemeente
  FROM public.coffeeshop_member_links l JOIN active_register ar ON ar.id = l.register_id
  JOIN public.members_data md ON md.id = l.member_id AND md.member_type IN ('member', 'lead')
  WHERE l.status = 'bevestigd' ORDER BY l.register_id, l.bevestigd_op DESC NULLS LAST, l.updated_at DESC
),
effective_members AS (
  SELECT md.id AS member_id, md.data, me.data AS edit_data FROM public.members_data md
  LEFT JOIN public.member_edits me ON me.member_id = md.id WHERE md.member_type IN ('member', 'lead')
),
member_locations AS (
  SELECT em.member_id, loc.ordinality::integer AS location_index,
    COALESCE(public.normalize_gemeente(COALESCE(NULLIF(btrim(loc.value->>'plaats'), ''), NULLIF(btrim(em.edit_data->>'plaats'), ''), NULLIF(btrim(em.data->>'plaats'), ''))), 'Onbekend') AS gemeente,
    lower(regexp_replace(COALESCE(loc.value->>'naam', ''), '[^a-zA-Z0-9]', '', 'g')) || '|' || lower(regexp_replace(COALESCE(loc.value->>'adres', ''), '[^a-zA-Z0-9]', '', 'g')) || '|' || lower(regexp_replace(COALESCE(loc.value->>'postcode', ''), '[^a-zA-Z0-9]', '', 'g')) AS location_key,
    upper(regexp_replace(COALESCE(loc.value->>'postcode', ''), '\s+', '', 'g')) AS postcode
  FROM effective_members em CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(em.edit_data->'locaties') = 'array' THEN em.edit_data->'locaties' WHEN jsonb_typeof(em.data->'locaties') = 'array' THEN em.data->'locaties' ELSE '[]'::jsonb END) WITH ORDINALITY AS loc(value, ordinality)
  WHERE btrim(COALESCE(loc.value->>'adres', '')) <> '' OR btrim(COALESCE(loc.value->>'plaats', '')) <> ''
),
fallback_locations AS (
  SELECT em.member_id, gs.n AS location_index, COALESCE(public.normalize_gemeente(COALESCE(NULLIF(btrim(em.edit_data->>'plaats'), ''), NULLIF(btrim(em.data->>'plaats'), ''))), 'Onbekend') AS gemeente, ''::text AS location_key, ''::text AS postcode
  FROM effective_members em CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(NULLIF(COALESCE(em.edit_data->>'aantalLocaties', em.data->>'aantalLocaties'), '')::integer, 1), 1)) AS gs(n)
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(em.edit_data->'locaties') = 'array' THEN em.edit_data->'locaties' WHEN jsonb_typeof(em.data->'locaties') = 'array' THEN em.data->'locaties' ELSE '[]'::jsonb END) l WHERE btrim(COALESCE(l->>'adres', '')) <> '' OR btrim(COALESCE(l->>'plaats', '')) <> '')
),
all_locations AS (SELECT * FROM member_locations UNION ALL SELECT * FROM fallback_locations),
exact_matches AS (
  SELECT DISTINCT ON (ml.member_id, ml.location_index) ml.member_id, ml.location_index
  FROM all_locations ml JOIN confirmed c ON c.member_id = ml.member_id
  WHERE c.location_key = ml.location_key OR (ml.postcode <> '' AND upper(regexp_replace(c.location_key, '\s+', '', 'g')) = ml.postcode)
),
member_counts AS (
  SELECT em.member_id,
    (SELECT count(*)::integer FROM all_locations ml WHERE ml.member_id=em.member_id) AS location_count,
    (SELECT count(*)::integer FROM confirmed c WHERE c.member_id=em.member_id) AS link_count,
    (SELECT count(*)::integer FROM exact_matches x WHERE x.member_id=em.member_id) AS exact_count
  FROM effective_members em
),
ranked_unmatched AS (
  SELECT ml.*, row_number() OVER (PARTITION BY ml.member_id ORDER BY ml.location_index) AS unmatched_rank
  FROM all_locations ml LEFT JOIN exact_matches x ON x.member_id=ml.member_id AND x.location_index=ml.location_index
  WHERE x.member_id IS NULL
),
represented AS (
  SELECT c.gemeente, 'register'::text AS source FROM confirmed c
  UNION ALL
  SELECT ru.gemeente, 'location'::text AS source FROM ranked_unmatched ru JOIN member_counts mc ON mc.member_id=ru.member_id
  WHERE ru.unmatched_rank > GREATEST(mc.link_count-mc.exact_count, 0)
),
municipalities AS (SELECT gemeente FROM active_register UNION SELECT gemeente FROM represented)
SELECT m.gemeente,
  (SELECT count(*)::integer FROM active_register ar WHERE ar.gemeente IS NOT DISTINCT FROM m.gemeente),
  (SELECT count(*)::integer FROM represented rp WHERE rp.gemeente IS NOT DISTINCT FROM m.gemeente),
  (SELECT count(*)::integer FROM confirmed c WHERE c.gemeente IS NOT DISTINCT FROM m.gemeente),
  (SELECT count(*)::integer FROM represented rp WHERE rp.source='location' AND rp.gemeente IS NOT DISTINCT FROM m.gemeente),
  (SELECT count(*)::integer FROM confirmed c WHERE c.location_key IS NULL AND c.gemeente IS NOT DISTINCT FROM m.gemeente)
FROM municipalities m ORDER BY m.gemeente;
$function$;