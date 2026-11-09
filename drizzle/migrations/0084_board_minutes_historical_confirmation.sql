ALTER TABLE public.board_minutes_adoptions ADD COLUMN confirmation_origin text;
COMMENT ON COLUMN public.board_minutes_adoptions.confirmation_origin IS 'Origin of current administrator confirmation; adopted_at never represents an inferred historical date.';
CREATE FUNCTION public.board_minutes_adopt_historical(p_versions uuid[], p_confirm boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE expected uuid[]; current_ids uuid[]; vid uuid; n integer:=0;
BEGIN
IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen vaststellen.' USING ERRCODE='42501'; END IF;
IF p_confirm IS DISTINCT FROM true OR p_versions IS NULL OR cardinality(p_versions) NOT BETWEEN 1 AND 1000 OR array_position(p_versions,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Bevestig eerst de getoonde aantallen.'; END IF;
SELECT array_agg(x ORDER BY x) INTO expected FROM (SELECT DISTINCT unnest(p_versions) x) s;
IF cardinality(expected)<>cardinality(p_versions) THEN RAISE EXCEPTION 'Dubbele versies.'; END IF;
PERFORM id FROM public.board_minutes_meetings ORDER BY id FOR UPDATE;
SELECT array_agg(v.id ORDER BY v.id) INTO current_ids FROM public.board_minutes_meetings m CROSS JOIN LATERAL (SELECT * FROM public.board_minutes_versions WHERE meeting_id=m.id ORDER BY version DESC LIMIT 1) v JOIN public.board_minutes_import_details d ON d.version_id=v.id
WHERE m.source IN ('onedrive','topical') AND d.details->>'status'='historisch-onbevestigd' AND v.meeting_date<'2026-11-06' AND coalesce(d.details->>'reportKind','')<>'agenda-only' AND coalesce(d.details->>'reportMissing','false')<>'true' AND NOT(m.source='topical' AND v.meeting_date='2026-06-04') AND length(btrim(v.report))>0 AND EXISTS(SELECT 1 FROM public.board_minutes_files f WHERE f.version_id=v.id) AND NOT EXISTS(SELECT 1 FROM public.board_minutes_adoptions a WHERE a.version_id=v.id);
IF expected IS DISTINCT FROM current_ids THEN RAISE EXCEPTION 'Het archief is gewijzigd; vernieuw en controleer de aantallen opnieuw.' USING ERRCODE='40001'; END IF;
FOREACH vid IN ARRAY expected LOOP
PERFORM public.board_minutes_adopt(vid,true);
UPDATE public.board_minutes_adoptions SET confirmation_origin='Gebruikersopdracht: historische notulen vóór 2026-11-06 bevestigd door beheerder nu; geen historische vaststellingsdatum.' WHERE version_id=vid AND adopted_by=auth.uid();
n:=n+1;
END LOOP;
RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.board_minutes_adopt_historical(uuid[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.board_minutes_adopt_historical(uuid[],boolean) TO authenticated;