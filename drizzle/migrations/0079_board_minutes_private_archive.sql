CREATE FUNCTION public.board_minutes_can_read() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid() IS NOT NULL AND public.contact_account_active() AND (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid())) $$;
REVOKE ALL ON FUNCTION public.board_minutes_can_read() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.board_minutes_can_read() TO authenticated;
CREATE TABLE public.board_minutes_meetings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL CHECK(source IN ('upload','onedrive','topical')), source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 500), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL, UNIQUE(source,source_id));
GRANT SELECT ON public.board_minutes_meetings TO authenticated; GRANT ALL ON public.board_minutes_meetings TO service_role;
ALTER TABLE public.board_minutes_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_minutes_meetings_read ON public.board_minutes_meetings FOR SELECT TO authenticated USING(public.board_minutes_can_read());
CREATE TABLE public.board_minutes_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id uuid NOT NULL REFERENCES public.board_minutes_meetings(id), version integer NOT NULL, meeting_date date NOT NULL, title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300), report text NOT NULL DEFAULT '' CHECK(length(report)<=200000), decisions jsonb NOT NULL DEFAULT '[]', actions jsonb NOT NULL DEFAULT '[]', source_url text, content_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL, UNIQUE(meeting_id,version), UNIQUE(meeting_id,content_hash));
GRANT SELECT ON public.board_minutes_versions TO authenticated; GRANT ALL ON public.board_minutes_versions TO service_role;
ALTER TABLE public.board_minutes_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_minutes_versions_read ON public.board_minutes_versions FOR SELECT TO authenticated USING(public.board_minutes_can_read());
CREATE TABLE public.board_minutes_adoptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_id uuid NOT NULL UNIQUE REFERENCES public.board_minutes_versions(id), adopted_at timestamptz NOT NULL DEFAULT now(), adopted_by uuid NOT NULL);
GRANT SELECT ON public.board_minutes_adoptions TO authenticated; GRANT ALL ON public.board_minutes_adoptions TO service_role;
ALTER TABLE public.board_minutes_adoptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_minutes_adoptions_read ON public.board_minutes_adoptions FOR SELECT TO authenticated USING(public.board_minutes_can_read());
CREATE TABLE public.board_minutes_files(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_id uuid NOT NULL REFERENCES public.board_minutes_versions(id), path text NOT NULL, original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 255), sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 20971520), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL, UNIQUE(version_id,sha256));
GRANT SELECT ON public.board_minutes_files TO authenticated; GRANT ALL ON public.board_minutes_files TO service_role;
ALTER TABLE public.board_minutes_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_minutes_files_read ON public.board_minutes_files FOR SELECT TO authenticated USING(public.board_minutes_can_read());
CREATE FUNCTION public.board_minutes_save(p_meeting uuid,p_expected uuid,p_source text,p_source_id text,p_date date,p_title text,p_report text,p_decisions jsonb,p_actions jsonb,p_url text,p_confirm boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
h:=encode(extensions.digest(convert_to(jsonb_build_object('date',p_date,'title',btrim(p_title),'report',p_report,'decisions',p_decisions,'actions',p_actions,'url',p_url)::text,'UTF8'),'sha256'),'hex');
SELECT id INTO vid FROM public.board_minutes_versions WHERE meeting_id=mid AND content_hash=h; IF vid IS NOT NULL THEN RETURN vid; END IF;
SELECT id,version INTO latest,num FROM public.board_minutes_versions WHERE meeting_id=mid ORDER BY version DESC LIMIT 1;
IF p_expected IS DISTINCT FROM latest THEN RAISE EXCEPTION 'Er is al een nieuwere versie; vernieuw eerst.' USING ERRCODE='40001'; END IF;
INSERT INTO public.board_minutes_versions(meeting_id,version,meeting_date,title,report,decisions,actions,source_url,content_hash,created_by) VALUES(mid,coalesce(num,0)+1,p_date,btrim(p_title),p_report,p_decisions,p_actions,p_url,h,auth.uid()) RETURNING id INTO vid; RETURN vid; END $$;
REVOKE ALL ON FUNCTION public.board_minutes_save(uuid,uuid,text,text,date,text,text,jsonb,jsonb,text,boolean) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.board_minutes_save(uuid,uuid,text,text,date,text,text,jsonb,jsonb,text,boolean) TO authenticated;
CREATE FUNCTION public.board_minutes_adopt(p_version uuid,p_confirm boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE mid uuid; latest uuid; BEGIN
IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen vaststellen.' USING ERRCODE='42501'; END IF;
IF p_confirm IS DISTINCT FROM true THEN RAISE EXCEPTION 'Bevestiging vereist.'; END IF;
SELECT meeting_id INTO mid FROM public.board_minutes_versions WHERE id=p_version; PERFORM 1 FROM public.board_minutes_meetings WHERE id=mid FOR UPDATE;
SELECT id INTO latest FROM public.board_minutes_versions WHERE meeting_id=mid ORDER BY version DESC LIMIT 1;
IF latest IS NULL OR latest<>p_version THEN RAISE EXCEPTION 'Alleen de nieuwste versie kan worden vastgesteld.'; END IF;
INSERT INTO public.board_minutes_adoptions(version_id,adopted_by) VALUES(p_version,auth.uid()) ON CONFLICT(version_id) DO NOTHING; END $$;
REVOKE ALL ON FUNCTION public.board_minutes_adopt(uuid,boolean) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.board_minutes_adopt(uuid,boolean) TO authenticated;
CREATE FUNCTION public.board_minutes_attach(p_version uuid,p_path text,p_name text,p_hash text,p_size integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE mid uuid; fid uuid; BEGIN
IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen bijlagen toevoegen.' USING ERRCODE='42501'; END IF;
SELECT meeting_id INTO mid FROM public.board_minutes_versions WHERE id=p_version; PERFORM 1 FROM public.board_minutes_meetings WHERE id=mid FOR UPDATE;
IF mid IS NULL OR EXISTS(SELECT 1 FROM public.board_minutes_adoptions WHERE version_id=p_version) THEN RAISE EXCEPTION 'Maak eerst een nieuwe conceptversie.'; END IF;
IF p_hash !~ '^[a-f0-9]{64}$' OR p_path !~ ('^'||mid::text||'/'||p_hash||'\.(pdf|docx|doc|txt)$') OR p_name ~ '[/\\[:cntrl:]]' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='board-minutes' AND name=p_path AND (metadata->>'size')::bigint=p_size) THEN RAISE EXCEPTION 'Bijlage ontbreekt of is ongeldig.'; END IF;
INSERT INTO public.board_minutes_files(version_id,path,original_name,sha256,size_bytes,created_by) VALUES(p_version,p_path,p_name,p_hash,p_size,auth.uid()) ON CONFLICT(version_id,sha256) DO NOTHING RETURNING id INTO fid; IF fid IS NULL THEN SELECT id INTO fid FROM public.board_minutes_files WHERE version_id=p_version AND sha256=p_hash; END IF; RETURN fid; END $$;
REVOKE ALL ON FUNCTION public.board_minutes_attach(uuid,text,text,text,integer) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.board_minutes_attach(uuid,text,text,text,integer) TO authenticated;
CREATE POLICY board_minutes_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='board-minutes' AND public.board_minutes_can_read() AND EXISTS(SELECT 1 FROM public.board_minutes_files f WHERE f.path=name));
CREATE POLICY board_minutes_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='board-minutes' AND auth.uid() IS NOT NULL AND public.contact_account_active() AND public.has_role(auth.uid(),'admin') AND name ~ '^[a-f0-9-]{36}/[a-f0-9]{64}\.(pdf|docx|doc|txt)$' AND EXISTS(SELECT 1 FROM public.board_minutes_meetings m WHERE m.id::text=split_part(name,'/',1)));
COMMENT ON TABLE public.board_minutes_versions IS 'Append-only board minutes; no direct authenticated mutations; adopted versions remain unchanged.';