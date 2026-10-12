CREATE OR REPLACE FUNCTION public.get_member_bank_aggregate()
RETURNS TABLE(bank_code text, aantal integer, totaal_leden integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Niet ingelogd' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role IN ('extern'::app_role,'inhuur'::app_role))
     AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.is_board_member(v_uid)
          OR EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = v_uid)) THEN
    RAISE EXCEPTION 'Geen geldige ledenkoppeling' USING ERRCODE = '42501';
  END IF;
  -- Alleen aantallen per 4-letterige bankcode; nooit IBANs of lid-identificatie.
  RETURN QUERY
  WITH leden AS (
    SELECT m.id, COALESCE(e.data->'ibans', m.data->'ibans') AS ibans
    FROM public.members_data m LEFT JOIN public.member_edits e ON e.member_id = m.id
    WHERE m.member_type = 'member'
  ), codes AS (
    SELECT l.id, upper(substr(regexp_replace(x, '\s', '', 'g'), 5, 4)) AS code
    FROM leden l CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(l.ibans)='array' THEN l.ibans ELSE '[]'::jsonb END) x
    WHERE length(regexp_replace(x, '\s', '', 'g')) >= 8
  ), per_lid AS (
    SELECT l.id, COALESCE(c.code, '') AS code FROM leden l LEFT JOIN codes c ON c.id = l.id
    GROUP BY l.id, COALESCE(c.code, '')
  )
  SELECT p.code, count(*)::int, (SELECT count(*)::int FROM leden)
  FROM per_lid p GROUP BY p.code;
END $$;
REVOKE ALL ON FUNCTION public.get_member_bank_aggregate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_bank_aggregate() TO authenticated;