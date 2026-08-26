CREATE OR REPLACE FUNCTION public.merge_member_locations(_base jsonb, _overlay jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  base_loc jsonb;
  overlay_loc jsonb;
  matched_overlay_indexes integer[] := ARRAY[]::integer[];
  overlay_index integer;
  base_postcode text;
  base_name text;
  base_address text;
  overlay_postcode text;
  overlay_name text;
  overlay_address text;
BEGIN
  IF jsonb_typeof(_base) <> 'array' THEN _base := '[]'::jsonb; END IF;
  IF jsonb_typeof(_overlay) <> 'array' THEN RETURN _base; END IF;

  FOR base_loc IN SELECT value FROM jsonb_array_elements(_base)
  LOOP
    overlay_loc := NULL;
    overlay_index := NULL;
    base_postcode := upper(regexp_replace(COALESCE(base_loc->>'postcode', ''), '[^A-Za-z0-9]', '', 'g'));
    base_name := lower(regexp_replace(COALESCE(base_loc->>'naam', ''), '[^A-Za-z0-9]', '', 'g'));
    base_address := lower(regexp_replace(COALESCE(base_loc->>'adres', ''), '[^A-Za-z0-9]', '', 'g'));

    SELECT candidate.value, candidate.ordinality::integer
      INTO overlay_loc, overlay_index
    FROM jsonb_array_elements(_overlay) WITH ORDINALITY AS candidate(value, ordinality)
    WHERE NOT (candidate.ordinality::integer = ANY(matched_overlay_indexes))
      AND (
        (base_postcode <> '' AND upper(regexp_replace(COALESCE(candidate.value->>'postcode', ''), '[^A-Za-z0-9]', '', 'g')) = base_postcode)
        OR (
          base_name <> ''
          AND lower(regexp_replace(COALESCE(candidate.value->>'naam', ''), '[^A-Za-z0-9]', '', 'g')) = base_name
          AND (
            base_address = ''
            OR lower(regexp_replace(COALESCE(candidate.value->>'adres', ''), '[^A-Za-z0-9]', '', 'g')) = base_address
          )
        )
        OR (
          base_address <> ''
          AND lower(regexp_replace(COALESCE(candidate.value->>'adres', ''), '[^A-Za-z0-9]', '', 'g')) = base_address
        )
      )
    ORDER BY
      CASE WHEN base_postcode <> '' AND upper(regexp_replace(COALESCE(candidate.value->>'postcode', ''), '[^A-Za-z0-9]', '', 'g')) = base_postcode THEN 0 ELSE 1 END,
      candidate.ordinality
    LIMIT 1;

    IF overlay_loc IS NULL THEN
      result := result || jsonb_build_array(base_loc);
    ELSE
      result := result || jsonb_build_array(base_loc || overlay_loc);
      matched_overlay_indexes := array_append(matched_overlay_indexes, overlay_index);
    END IF;
  END LOOP;

  FOR overlay_loc, overlay_index IN
    SELECT value, ordinality::integer
    FROM jsonb_array_elements(_overlay) WITH ORDINALITY
  LOOP
    IF NOT (overlay_index = ANY(matched_overlay_indexes)) THEN
      result := result || jsonb_build_array(overlay_loc);
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_member_locations(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_member_locations(jsonb, jsonb) TO authenticated, service_role;

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
  SELECT md.id AS member_id,
    jsonb_set(
      COALESCE(md.data, '{}'::jsonb) || (COALESCE(me.data, '{}'::jsonb) - 'locaties'),
      '{locaties}',
      public.merge_member_locations(md.data->'locaties', me.data->'locaties'),
      true
    ) AS data
  FROM public.members_data md
  LEFT JOIN public.member_edits me ON me.member_id = md.id
  WHERE md.member_type IN ('member', 'lead')
),
member_locations AS (
  SELECT em.member_id, loc.ordinality::integer AS location_index,
    COALESCE(public.normalize_gemeente(COALESCE(NULLIF(btrim(loc.value->>'plaats'), ''), NULLIF(btrim(em.data->>'plaats'), ''))), 'Onbekend') AS gemeente,
    lower(regexp_replace(COALESCE(loc.value->>'naam', ''), '[^a-zA-Z0-9]', '', 'g')) || '|' || lower(regexp_replace(COALESCE(loc.value->>'adres', ''), '[^a-zA-Z0-9]', '', 'g')) || '|' || lower(regexp_replace(COALESCE(loc.value->>'postcode', ''), '[^a-zA-Z0-9]', '', 'g')) AS location_key,
    upper(regexp_replace(COALESCE(loc.value->>'postcode', ''), '\s+', '', 'g')) AS postcode
  FROM effective_members em
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(em.data->'locaties') = 'array' THEN em.data->'locaties' ELSE '[]'::jsonb END) WITH ORDINALITY AS loc(value, ordinality)
  WHERE btrim(COALESCE(loc.value->>'adres', '')) <> '' OR btrim(COALESCE(loc.value->>'plaats', '')) <> ''
),
fallback_locations AS (
  SELECT em.member_id, gs.n AS location_index,
    COALESCE(public.normalize_gemeente(NULLIF(btrim(em.data->>'plaats'), '')), 'Onbekend') AS gemeente,
    ''::text AS location_key, ''::text AS postcode
  FROM effective_members em
  CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(NULLIF(em.data->>'aantalLocaties', '')::integer, 1), 1)) AS gs(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(em.data->'locaties') = 'array' THEN em.data->'locaties' ELSE '[]'::jsonb END) l
    WHERE btrim(COALESCE(l->>'adres', '')) <> '' OR btrim(COALESCE(l->>'plaats', '')) <> ''
  )
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