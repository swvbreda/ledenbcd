-- 1. Additieve, nullable kolommen: geen enkele bestaande rij verandert.
ALTER TABLE public.coffeeshop_register
  ADD COLUMN IF NOT EXISTS telt_mee boolean,
  ADD COLUMN IF NOT EXISTS uitsluitreden text,
  ADD COLUMN IF NOT EXISTS exploitatie_status_bron text,
  ADD COLUMN IF NOT EXISTS controle_nodig_bron boolean,
  ADD COLUMN IF NOT EXISTS is_baseline_shop_bron boolean,
  ADD COLUMN IF NOT EXISTS bron_schema_version text;

-- 2. Eén gedeelde predicate. Typed telt_mee is leidend; alleen wanneer die
--    NULL is (v1-bron, nog geen sync) geldt de bestaande legacylogica.
CREATE OR REPLACE FUNCTION public.register_telt_mee(
  _telt_mee boolean,
  _vervallen boolean,
  _status text,
  _raw jsonb
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(_vervallen, false) THEN false
    WHEN _telt_mee IS NOT NULL THEN _telt_mee
    ELSE COALESCE((_raw->>'is_ruis')::boolean, false) = false
         AND lower(COALESCE(_status, '')) <> 'gesloten'
         AND COALESCE(_raw->>'gesloten_op', '') = ''
  END
$$;

REVOKE EXECUTE ON FUNCTION public.register_telt_mee(boolean, boolean, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_telt_mee(boolean, boolean, text, jsonb) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_coffeeshop_register_telt_mee
  ON public.coffeeshop_register (telt_mee) WHERE vervallen = false;

-- 3. Telfuncties naar de gedeelde predicate.
CREATE OR REPLACE FUNCTION public.get_register_link_summary()
RETURNS TABLE(actieve_shops integer, bevestigde_koppelingen integer, gekoppelde_leden integer, vervallen_koppelingen integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT COUNT(*)::integer
       FROM public.coffeeshop_register r
      WHERE public.register_telt_mee(r.telt_mee, r.vervallen, r.status, r.raw)),
    (SELECT COUNT(DISTINCT l.register_id)::integer
       FROM public.coffeeshop_member_links l
       JOIN public.coffeeshop_register r ON r.id = l.register_id
      WHERE l.status = 'bevestigd'
        AND public.register_telt_mee(r.telt_mee, r.vervallen, r.status, r.raw)),
    (SELECT COUNT(DISTINCT l.member_id)::integer
       FROM public.coffeeshop_member_links l
      WHERE l.status = 'bevestigd'),
    (SELECT COUNT(*)::integer
       FROM public.coffeeshop_member_links l
       JOIN public.coffeeshop_register r ON r.id = l.register_id
      WHERE l.status = 'bevestigd'
        AND NOT public.register_telt_mee(r.telt_mee, r.vervallen, r.status, r.raw))
$function$;

CREATE OR REPLACE FUNCTION public.get_register_plaats_stats()
RETURNS TABLE(plaats text, aantal integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) AS plaats,
         COUNT(*)::integer AS aantal
  FROM public.coffeeshop_register r
  WHERE public.register_telt_mee(r.telt_mee, r.vervallen, r.status, r.raw)
    AND COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) IS NOT NULL
  GROUP BY 1
$function$;

CREATE OR REPLACE FUNCTION public.get_representation_stats()
RETURNS TABLE(gemeente text, landelijke_shops integer, vertegenwoordigde_shops integer, gekoppelde_registershops integer, niet_gekoppelde_locaties integer, koppelingen_zonder_vestiging integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
WITH active_register AS (
  SELECT r.id,
    COALESCE(NULLIF(btrim(r.gemeente), ''), NULLIF(btrim(r.plaats), '')) AS gemeente,
    lower(regexp_replace(lower(COALESCE(r.straat,'') || COALESCE(r.huisnummer,'') || COALESCE(r.huisnummer_toevoeging,'') || COALESCE(r.postcode,'')), '[^a-z0-9]', '', 'g')) AS addr_key
  FROM public.coffeeshop_register r
  WHERE public.register_telt_mee(r.telt_mee, r.vervallen, r.status, r.raw)
),
confirmed AS (
  SELECT DISTINCT ON (l.register_id) l.register_id, l.member_id, NULLIF(btrim(l.location_key), '') AS location_key, ar.gemeente, ar.addr_key
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
member_locations_raw AS (
  SELECT em.member_id, loc.ordinality::integer AS location_index,
    COALESCE(public.normalize_gemeente(COALESCE(NULLIF(btrim(loc.value->>'plaats'), ''), NULLIF(btrim(em.data->>'plaats'), ''))), 'Onbekend') AS gemeente,
    lower(regexp_replace(COALESCE(loc.value->>'naam', ''), '[^a-zA-Z0-9]', '', 'g')) || '|' || lower(regexp_replace(COALESCE(loc.value->>'adres', ''), '[^a-zA-Z0-9]', '', 'g')) || '|' || lower(regexp_replace(COALESCE(loc.value->>'postcode', ''), '[^a-zA-Z0-9]', '', 'g')) AS location_key,
    upper(regexp_replace(COALESCE(loc.value->>'postcode', ''), '\s+', '', 'g')) AS postcode,
    lower(regexp_replace(lower(COALESCE(loc.value->>'adres','') || COALESCE(loc.value->>'postcode','')), '[^a-z0-9]', '', 'g')) AS addr_key
  FROM effective_members em
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(em.data->'locaties') = 'array' THEN em.data->'locaties' ELSE '[]'::jsonb END) WITH ORDINALITY AS loc(value, ordinality)
  WHERE btrim(COALESCE(loc.value->>'adres', '')) <> '' OR btrim(COALESCE(loc.value->>'plaats', '')) <> ''
),
member_locations AS (
  SELECT DISTINCT ON (member_id, CASE WHEN addr_key = '' THEN 'idx:' || location_index::text ELSE addr_key END)
    member_id, location_index, gemeente, location_key, postcode, addr_key
  FROM member_locations_raw
  ORDER BY member_id, CASE WHEN addr_key = '' THEN 'idx:' || location_index::text ELSE addr_key END, location_index
),
fallback_locations AS (
  SELECT em.member_id, gs.n AS location_index,
    COALESCE(public.normalize_gemeente(NULLIF(btrim(em.data->>'plaats'), '')), 'Onbekend') AS gemeente,
    ''::text AS location_key, ''::text AS postcode, ''::text AS addr_key
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
  WHERE c.location_key = ml.location_key
     OR (ml.postcode <> '' AND upper(regexp_replace(c.location_key, '\s+', '', 'g')) = ml.postcode)
     OR (ml.addr_key <> '' AND c.addr_key = ml.addr_key)
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
counted_unmatched AS (
  SELECT ru.member_id, ru.location_index, ru.gemeente, ru.addr_key
  FROM ranked_unmatched ru JOIN member_counts mc ON mc.member_id=ru.member_id
  WHERE ru.unmatched_rank > GREATEST(mc.link_count-mc.exact_count, 0)
),
unique_unmatched AS (
  SELECT DISTINCT ON (CASE WHEN cu.addr_key = '' THEN 'm:' || cu.member_id::text || ':' || cu.location_index::text ELSE cu.addr_key END)
    cu.gemeente
  FROM counted_unmatched cu
  WHERE cu.addr_key = '' OR NOT EXISTS (SELECT 1 FROM confirmed c WHERE c.addr_key <> '' AND c.addr_key = cu.addr_key)
  ORDER BY CASE WHEN cu.addr_key = '' THEN 'm:' || cu.member_id::text || ':' || cu.location_index::text ELSE cu.addr_key END, cu.member_id, cu.location_index
),
represented AS (
  SELECT c.gemeente, 'register'::text AS source FROM confirmed c
  UNION ALL
  SELECT uu.gemeente, 'location'::text AS source FROM unique_unmatched uu
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

-- 4. Logo's volgen dezelfde regel, zodat de publieke logowand niet afwijkt.
CREATE OR REPLACE FUNCTION public.get_member_register_logos()
RETURNS TABLE(member_id integer, location_key text, logo_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select l.member_id, l.location_key, r.logo_url
  from public.coffeeshop_member_links l
  join public.coffeeshop_register r on r.id = l.register_id
  where l.status = 'bevestigd'
    and r.logo_url is not null
    and public.register_telt_mee(r.telt_mee, r.vervallen, r.status, r.raw)
$function$;