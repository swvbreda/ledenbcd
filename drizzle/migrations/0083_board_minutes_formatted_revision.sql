CREATE FUNCTION public.board_minutes_import_formatted(p_source_id text,p_expected uuid,p_date date,p_title text,p_report text,p_decisions jsonb,p_actions jsonb,p_url text,p_hash text,p_details jsonb,p_source_text text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE mid uuid; latest uuid; vid uuid; fingerprint text; BEGIN
 IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen importeren.' USING ERRCODE='42501'; END IF;
 SELECT id INTO mid FROM public.board_minutes_meetings WHERE source='topical' AND source_id=p_source_id FOR UPDATE;
 IF mid IS NULL THEN RAISE EXCEPTION 'Bestaande Topical-vergadering niet gevonden.'; END IF;
 IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR length(p_details::text)>100000 OR p_source_text IS NULL OR length(p_source_text)>200000 THEN RAISE EXCEPTION 'Ongeldige opmaakbron.'; END IF;
 IF p_details->'formatted' IS DISTINCT FROM 'true'::jsonb OR p_details->>'status' IS DISTINCT FROM 'historisch-onbevestigd' OR p_details->'reviewRequired' IS DISTINCT FROM 'true'::jsonb OR p_details->>'reportKind' IS NULL OR p_details->>'reportKind' NOT IN ('summary','ai-report','brief-notes','agenda-only') OR jsonb_typeof(p_details->'reportMissing') IS DISTINCT FROM 'boolean' OR (p_details->>'reportMissing')::boolean IS DISTINCT FROM (p_details->>'reportKind'='agenda-only') THEN RAISE EXCEPTION 'Opmaakstatus moet worden gecontroleerd.'; END IF;
 IF p_details->>'reportKind'='agenda-only' AND p_report IS DISTINCT FROM '' THEN RAISE EXCEPTION 'Agenda is geen verslag.'; END IF;
 IF p_details->>'originalSourceSha256' IS NULL OR p_details->>'originalSourceSha256' !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM public.board_minutes_files f JOIN public.board_minutes_versions v ON v.id=f.version_id JOIN storage.objects o ON o.bucket_id='board-minutes' AND o.name=f.path WHERE v.meeting_id=mid AND f.sha256=p_details->>'originalSourceSha256' AND f.path LIKE '%.pdf') THEN RAISE EXCEPTION 'Oorspronkelijke privé PDF-bron ontbreekt of hash wijkt af.'; END IF;
 fingerprint:=encode(extensions.digest(convert_to(jsonb_build_object('date',p_date,'title',p_title,'report',p_report,'decisions',p_decisions,'actions',p_actions,'url',p_url,'hash',p_hash,'details',p_details-'formattedFingerprint','source_text',p_source_text)::text,'UTF8'),'sha256'),'hex');
 SELECT v.id INTO vid FROM public.board_minutes_versions v JOIN public.board_minutes_import_details d ON d.version_id=v.id WHERE v.meeting_id=mid AND d.details->>'formattedFingerprint'=fingerprint;
 IF vid IS NOT NULL THEN RETURN vid; END IF;
 SELECT id INTO latest FROM public.board_minutes_versions WHERE meeting_id=mid ORDER BY version DESC LIMIT 1;
 IF latest IS NULL OR latest IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Er is al een nieuwere versie; vernieuw eerst.' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.board_minutes_versions WHERE meeting_id=mid AND meeting_date=p_date) THEN RAISE EXCEPTION 'Vergaderdatum wijkt af van historische bron.'; END IF;
 vid:=public.board_minutes_save_revision(mid,p_expected,'topical',p_source_id,p_date,p_title,p_report,p_decisions,p_actions,p_url,true,fingerprint);
 INSERT INTO public.board_minutes_import_details(version_id,details,source_text,created_by) VALUES(vid,(p_details-'formattedFingerprint')||jsonb_build_object('formattedFingerprint',fingerprint),p_source_text,auth.uid());
 RETURN vid;
END $fn$;
REVOKE ALL ON FUNCTION public.board_minutes_import_formatted(text,uuid,date,text,text,jsonb,jsonb,text,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.board_minutes_import_formatted(text,uuid,date,text,text,jsonb,jsonb,text,text,jsonb,text) TO authenticated;