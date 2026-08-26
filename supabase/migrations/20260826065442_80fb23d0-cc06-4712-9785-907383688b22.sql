CREATE OR REPLACE FUNCTION public.get_representation_stats()
RETURNS TABLE(gemeente text, landelijke_shops integer, vertegenwoordigde_shops integer, gekoppelde_registershops integer, niet_gekoppelde_locaties integer, koppelingen_zonder_vestiging integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $function$
WITH active_register AS (
  SELECT r.id, COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) AS gemeente
  FROM public.coffeeshop_register r
  WHERE r.vervallen = false AND COALESCE((r.raw->>'is_ruis')::boolean, false) = false
    AND lower(COALESCE(r.status, '')) <> 'gesloten' AND COALESCE(r.raw->>'gesloten_op', '') = ''
),
confirmed AS (
  SELECT DISTINCT ON (l.register_id) l.register_id, l.member_id, NULLIF(btrim(l.location_key), '') AS location_key, ar.gemeente
  FROM public.coffeeshop_member_links l JOIN active_register ar ON ar.id = l.register_id
  JOIN public.members_data md ON md.id = l.member_id AND md.member_type IN ('member', 'lead')
  WHERE l.status = 'bevestigd'
  ORDER BY l.register_id, l.bevestigd_op DESC NULLS LAST, l.updated_at DESC
),
effective_members AS (
  SELECT md.id AS member_id, md.data, me.data AS edit_data FROM public.members_data md
  LEFT JOIN public.member_edits me ON me.member_id = md.id WHERE md.member_type IN ('member', 'lead')
),
member_locations AS (
  SELECT em.member_id, loc.ordinality::integer AS location_index,
    COALESCE(NULLIF(btrim(loc.value->>'plaats'), ''), NULLIF(btrim(em.edit_data->>'plaats'), ''), NULLIF(btrim(em.data->>'plaats'), ''), 'Onbekend') AS gemeente,
    lower(regexp_replace(COALESCE(loc.value->>'naam', ''), '[^a-zA-Z0-9]', '', 'g')) || '|' || lower(regexp_replace(COALESCE(loc.value->>'adres', ''), '[^a-zA-Z0-9]', '', 'g')) || '|' || lower(regexp_replace(COALESCE(loc.value->>'postcode', ''), '[^a-zA-Z0-9]', '', 'g')) AS location_key,
    upper(regexp_replace(COALESCE(loc.value->>'postcode', ''), '\s+', '', 'g')) AS postcode
  FROM effective_members em CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(em.edit_data->'locaties') = 'array' THEN em.edit_data->'locaties' WHEN jsonb_typeof(em.data->'locaties') = 'array' THEN em.data->'locaties' ELSE '[]'::jsonb END) WITH ORDINALITY AS loc(value, ordinality)
  WHERE btrim(COALESCE(loc.value->>'adres', '')) <> '' OR btrim(COALESCE(loc.value->>'plaats', '')) <> ''
),
fallback_locations AS (
  SELECT em.member_id, gs.n AS location_index,
    COALESCE(NULLIF(btrim(em.edit_data->>'plaats'), ''), NULLIF(btrim(em.data->>'plaats'), ''), 'Onbekend') AS gemeente,
    ''::text AS location_key, ''::text AS postcode
  FROM effective_members em CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(NULLIF(COALESCE(em.edit_data->>'aantalLocaties', em.data->>'aantalLocaties'), '')::integer, 1), 1)) AS gs(n)
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(em.edit_data->'locaties') = 'array' THEN em.edit_data->'locaties' WHEN jsonb_typeof(em.data->'locaties') = 'array' THEN em.data->'locaties' ELSE '[]'::jsonb END) l WHERE btrim(COALESCE(l->>'adres', '')) <> '' OR btrim(COALESCE(l->>'plaats', '')) <> '')
),
all_locations AS (SELECT * FROM member_locations UNION ALL SELECT * FROM fallback_locations),
ranked_locations AS (SELECT ml.*, row_number() OVER (PARTITION BY ml.member_id ORDER BY ml.location_index) AS member_rank FROM all_locations ml),
confirmed_counts AS (SELECT member_id, count(*)::integer AS link_count FROM confirmed GROUP BY member_id),
classified_locations AS (
  SELECT ml.*, EXISTS (SELECT 1 FROM confirmed c WHERE c.member_id = ml.member_id AND (c.location_key = ml.location_key OR upper(regexp_replace(c.location_key, '\s+', '', 'g')) = ml.postcode)) OR ml.member_rank <= COALESCE(cc.link_count, 0) AS has_confirmed_link
  FROM ranked_locations ml LEFT JOIN confirmed_counts cc ON cc.member_id = ml.member_id
),
represented AS (
  SELECT c.gemeente, 'register'::text AS source FROM confirmed c
  UNION ALL SELECT cl.gemeente, 'location'::text AS source FROM classified_locations cl WHERE NOT cl.has_confirmed_link
),
municipalities AS (SELECT gemeente FROM active_register UNION SELECT gemeente FROM represented)
SELECT m.gemeente,
  (SELECT count(*)::integer FROM active_register ar WHERE ar.gemeente IS NOT DISTINCT FROM m.gemeente),
  (SELECT count(*)::integer FROM represented rp WHERE rp.gemeente IS NOT DISTINCT FROM m.gemeente),
  (SELECT count(*)::integer FROM confirmed c WHERE c.gemeente IS NOT DISTINCT FROM m.gemeente),
  (SELECT count(*)::integer FROM represented rp WHERE rp.source = 'location' AND rp.gemeente IS NOT DISTINCT FROM m.gemeente),
  (SELECT count(*)::integer FROM confirmed c WHERE c.location_key IS NULL AND c.gemeente IS NOT DISTINCT FROM m.gemeente)
FROM municipalities m ORDER BY m.gemeente;
$function$;
REVOKE ALL ON FUNCTION public.get_representation_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_representation_stats() TO service_role;