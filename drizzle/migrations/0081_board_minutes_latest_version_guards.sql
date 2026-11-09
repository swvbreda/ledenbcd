CREATE OR REPLACE FUNCTION public.board_minutes_save_revision(p_meeting uuid,p_expected uuid,p_source text,p_source_id text,p_date date,p_title text,p_report text,p_decisions jsonb,p_actions jsonb,p_url text,p_confirm boolean,p_file_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mid uuid; vid uuid; latest uuid; num integer; h text; BEGIN
IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen notulen beheren.' USING ERRCODE='42501'; END IF;
IF p_confirm IS DISTINCT FROM true THEN RAISE EXCEPTION 'Bevestig dat dit bestuursnotulen zijn.'; END IF;
IF p_date IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 300 OR p_report IS NULL OR length(p_report)>200000 OR p_source NOT IN ('upload','onedrive','topical') OR p_source IS NULL THEN RAISE EXCEPTION 'Ongeldige notulen.'; END IF;
IF jsonb_typeof(p_decisions) IS DISTINCT FROM 'array' OR jsonb_typeof(p_actions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_decisions)>200 OR jsonb_array_length(p_actions)>200 THEN RAISE EXCEPTION 'Ongeldige besluiten of acties.'; END IF;
IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_decisions) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}')>3000) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_actions) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}')>3000) THEN RAISE EXCEPTION 'Ongeldige besluiten of acties.'; END IF;
IF p_url IS NOT NULL AND (length(p_url)>2000 OR p_url !~ '^https://[^[:space:]]+$') THEN RAISE EXCEPTION 'Ongeldige bronverwijzing.'; END IF;
IF p_meeting IS NULL THEN
IF p_source<>'upload' AND (p_source_id IS NULL OR btrim(p_source_id)='') THEN RAISE EXCEPTION 'Bron-id vereist bij import.'; END IF;
INSERT INTO public.board_minutes_meetings(source,source_id,created_by) VALUES(p_source,coalesce(nullif(btrim(p_source_id),''),gen_random_uuid()::text),auth.uid()) ON CONFLICT(source,source_id) DO NOTHING RETURNING id INTO mid;
IF mid IS NULL THEN SELECT id INTO mid FROM public.board_minutes_meetings WHERE source=p_source AND source_id=btrim(p_source_id); END IF;
ELSE mid:=p_meeting; END IF;
PERFORM 1 FROM public.board_minutes_meetings WHERE id=mid FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Vergadering niet gevonden.'; END IF;
IF p_file_hash IS NOT NULL AND p_file_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Ongeldige bestandhash.'; END IF;
h:=encode(extensions.digest(convert_to(jsonb_build_object('date',p_date,'title',btrim(p_title),'report',p_report,'decisions',p_decisions,'actions',p_actions,'url',p_url,'file_hash',p_file_hash,'revision_parent',p_expected)::text,'UTF8'),'sha256'),'hex');
SELECT id INTO vid FROM public.board_minutes_versions WHERE meeting_id=mid AND content_hash=h; IF vid IS NOT NULL THEN RETURN vid; END IF;
SELECT id,version INTO latest,num FROM public.board_minutes_versions WHERE meeting_id=mid ORDER BY version DESC LIMIT 1;
IF p_meeting IS NOT NULL AND p_expected IS DISTINCT FROM latest THEN RAISE EXCEPTION 'Er is al een nieuwere versie; vernieuw eerst.' USING ERRCODE='40001'; END IF;
INSERT INTO public.board_minutes_versions(meeting_id,version,meeting_date,title,report,decisions,actions,source_url,content_hash,created_by) VALUES(mid,coalesce(num,0)+1,p_date,btrim(p_title),p_report,p_decisions,p_actions,p_url,h,auth.uid()) RETURNING id INTO vid;
IF latest IS NOT NULL THEN INSERT INTO public.board_minutes_files(version_id,path,original_name,sha256,size_bytes,created_by) SELECT vid,path,original_name,sha256,size_bytes,auth.uid() FROM public.board_minutes_files WHERE version_id=latest; END IF;
RETURN vid; END $$;
REVOKE ALL ON FUNCTION public.board_minutes_save_revision(uuid,uuid,text,text,date,text,text,jsonb,jsonb,text,boolean,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.board_minutes_save_revision(uuid,uuid,text,text,date,text,text,jsonb,jsonb,text,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.board_minutes_attach(p_version uuid,p_path text,p_name text,p_hash text,p_size integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE mid uuid; fid uuid; BEGIN
IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen bijlagen toevoegen.' USING ERRCODE='42501'; END IF;
SELECT meeting_id INTO mid FROM public.board_minutes_versions WHERE id=p_version; PERFORM 1 FROM public.board_minutes_meetings WHERE id=mid FOR UPDATE;
IF mid IS NULL OR p_version IS DISTINCT FROM (SELECT id FROM public.board_minutes_versions WHERE meeting_id=mid ORDER BY version DESC LIMIT 1) OR EXISTS(SELECT 1 FROM public.board_minutes_adoptions WHERE version_id=p_version) THEN RAISE EXCEPTION 'Maak eerst een nieuwe conceptversie.'; END IF;
IF p_hash !~ '^[a-f0-9]{64}$' OR p_path !~ ('^'||mid::text||'/'||p_hash||'\.(pdf|docx|doc|txt)$') OR p_name ~ '[/\\[:cntrl:]]' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='board-minutes' AND name=p_path AND (metadata->>'size')::bigint=p_size) THEN RAISE EXCEPTION 'Bijlage ontbreekt of is ongeldig.'; END IF;
INSERT INTO public.board_minutes_files(version_id,path,original_name,sha256,size_bytes,created_by) VALUES(p_version,p_path,p_name,p_hash,p_size,auth.uid()) ON CONFLICT(version_id,sha256) DO NOTHING RETURNING id INTO fid; IF fid IS NULL THEN SELECT id INTO fid FROM public.board_minutes_files WHERE version_id=p_version AND sha256=p_hash; END IF; RETURN fid; END $$;
REVOKE ALL ON FUNCTION public.board_minutes_attach(uuid,text,text,text,integer) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.board_minutes_attach(uuid,text,text,text,integer) TO authenticated;