-- Helper: normalisatie exact zoals de frontend (lowercase, alleen letters/cijfers)
CREATE OR REPLACE FUNCTION public.dir_norm(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(lower(coalesce(_v, '')), '[^a-z0-9]+', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.dir_loc_identity(_loc jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN upper(public.dir_norm(_loc->>'postcode')) <> '' THEN 'postcode:' || upper(public.dir_norm(_loc->>'postcode'))
    WHEN public.dir_norm(_loc->>'adres') <> '' THEN 'adres:' || public.dir_norm(_loc->>'adres')
    ELSE 'naam:' || public.dir_norm(_loc->>'naam') || '|plaats:' || public.dir_norm(_loc->>'plaats')
  END
$$;

CREATE OR REPLACE FUNCTION public.dir_loc_del_identity(_loc jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN upper(public.dir_norm(_loc->>'postcode')) <> '' AND public.dir_norm(_loc->>'adres') <> ''
      THEN 'locatie:' || upper(public.dir_norm(_loc->>'postcode')) || '|' || public.dir_norm(_loc->>'adres')
    WHEN public.dir_norm(_loc->>'adres') <> ''
      THEN 'locatie:adres:' || public.dir_norm(_loc->>'adres')
    ELSE public.dir_loc_identity(_loc)
  END
$$;

CREATE OR REPLACE FUNCTION public.dir_loc_deleted(_loc jsonb, _deleted text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT public.dir_loc_del_identity(_loc) = ANY(coalesce(_deleted, '{}'::text[]))
      OR public.dir_loc_identity(_loc) = ANY(coalesce(_deleted, '{}'::text[]))
$$;

CREATE OR REPLACE FUNCTION public.dir_loc_match(_a jsonb, _b jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN upper(public.dir_norm(_a->>'postcode')) <> ''
     AND upper(public.dir_norm(_a->>'postcode')) = upper(public.dir_norm(_b->>'postcode')) THEN true
    WHEN public.dir_norm(_a->>'adres') <> ''
     AND public.dir_norm(_a->>'adres') = public.dir_norm(_b->>'adres') THEN true
    ELSE public.dir_norm(_a->>'naam') <> ''
     AND public.dir_norm(_a->>'naam') = public.dir_norm(_b->>'naam')
     AND (public.dir_norm(_a->>'plaats') = '' OR public.dir_norm(_b->>'plaats') = ''
          OR public.dir_norm(_a->>'plaats') = public.dir_norm(_b->>'plaats'))
  END
$$;

-- Allowlist-projectie: uitsluitend niet-gevoelige presentatievelden
CREATE OR REPLACE FUNCTION public.dir_pick(_obj jsonb, _keys text[])
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_object_agg(k, _obj->k) FILTER (WHERE _obj ? k), '{}'::jsonb)
  FROM unnest(_keys) AS k
$$;

CREATE OR REPLACE FUNCTION public.member_directory_payload(_base jsonb, _overlay jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  base jsonb := coalesce(_base, '{}'::jsonb);
  overlay jsonb := coalesce(_overlay, '{}'::jsonb);
  deleted text[] := '{}';
  base_locs jsonb;
  ov_locs jsonb;
  merged jsonb := '[]'::jsonb;
  clean jsonb := '[]'::jsonb;
  used int[] := '{}';
  seen text[] := '{}';
  b jsonb;
  i int;
  midx int;
  loc jsonb;
  key text;
  top jsonb;
  loc_keys text[] := ARRAY['naam','plaats','gemeente','stadsdeel','adres','postcode','oprichtingsDatum','website','logo','instagram','facebook'];
  top_keys text[] := ARRAY['naam','plaats','stadsdeel','jarenLid','oprichtingJaar','oprichtingsDatum','lidSinds','lidJaren','website','instagram','facebook','googleMaps','oprichter','bestuursfunctie'];
BEGIN
  SELECT coalesce(array_agg(x), '{}'::text[]) INTO deleted
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(overlay->'_verwijderdeLocaties') = 'array'
         THEN overlay->'_verwijderdeLocaties' ELSE '[]'::jsonb END) AS x;

  base_locs := CASE WHEN jsonb_typeof(base->'locaties') = 'array' THEN base->'locaties' ELSE '[]'::jsonb END;
  ov_locs := CASE WHEN jsonb_typeof(overlay->'locaties') = 'array' THEN overlay->'locaties' ELSE '[]'::jsonb END;

  FOR b IN SELECT value FROM jsonb_array_elements(base_locs) LOOP
    IF public.dir_loc_deleted(b, deleted) THEN CONTINUE; END IF;
    midx := NULL;
    FOR i IN 0 .. jsonb_array_length(ov_locs) - 1 LOOP
      IF NOT (i = ANY(used)) AND coalesce(public.dir_loc_match(b, ov_locs->i), false) THEN
        midx := i; EXIT;
      END IF;
    END LOOP;
    IF midx IS NULL THEN
      merged := merged || jsonb_build_array(b);
    ELSE
      used := used || midx;
      merged := merged || jsonb_build_array(b || (ov_locs->midx));
    END IF;
  END LOOP;

  FOR i IN 0 .. jsonb_array_length(ov_locs) - 1 LOOP
    IF NOT (i = ANY(used)) AND NOT public.dir_loc_deleted(ov_locs->i, deleted) THEN
      merged := merged || jsonb_build_array(ov_locs->i);
    END IF;
  END LOOP;

  FOR loc IN SELECT value FROM jsonb_array_elements(merged) LOOP
    key := public.dir_loc_del_identity(loc);
    IF key = ANY(seen) THEN CONTINUE; END IF;
    seen := seen || key;
    clean := clean || jsonb_build_array(public.dir_pick(loc, loc_keys));
  END LOOP;

  top := public.dir_pick(base || public.dir_pick(overlay, top_keys), top_keys);

  RETURN top || jsonb_build_object(
    'locaties', clean,
    'aantalLocaties', jsonb_array_length(clean),
    'contacten', '[]'::jsonb,
    'contactpersoon', '',
    'functie', '',
    'telefoon', '',
    'email', '',
    'bedrijfsnaam', ''
  );
END
$$;

-- Beveiligde directory: alleen voor ingelogde leden met geldige ledenkoppeling
CREATE OR REPLACE FUNCTION public.get_members_directory()
RETURNS TABLE (id integer, member_type text, data jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Niet ingelogd' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = v_uid) THEN
    RAISE EXCEPTION 'Geen geldige ledenkoppeling' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role IN ('extern'::app_role, 'inhuur'::app_role)
  ) THEN
    RAISE EXCEPTION 'Geen toegang tot de ledendirectory' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.id, m.member_type,
         public.member_directory_payload(m.data::jsonb, e.data::jsonb)
  FROM public.members_data m
  LEFT JOIN public.member_edits e ON e.member_id = m.id
  WHERE m.member_type = 'member';
END
$$;

REVOKE ALL ON FUNCTION public.get_members_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_members_directory() TO authenticated;

REVOKE ALL ON FUNCTION public.member_directory_payload(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dir_pick(jsonb, text[]) FROM PUBLIC, anon;

-- Bestuur ziet dezelfde goedgekeurde wijzigingen als beheer
DROP POLICY IF EXISTS "Board members can read member edits" ON public.member_edits;
CREATE POLICY "Board members can read member edits"
ON public.member_edits FOR SELECT TO authenticated
USING (public.is_board_member((SELECT auth.uid())));