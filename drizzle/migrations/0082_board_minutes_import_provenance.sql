CREATE TABLE public.board_minutes_import_details (
 version_id uuid PRIMARY KEY REFERENCES public.board_minutes_versions(id),
 details jsonb NOT NULL,
 source_text text NOT NULL DEFAULT '',
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.board_minutes_import_details TO authenticated;
GRANT ALL ON public.board_minutes_import_details TO service_role;
ALTER TABLE public.board_minutes_import_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_minutes_import_read ON public.board_minutes_import_details FOR SELECT TO authenticated USING(public.board_minutes_can_read());
CREATE OR REPLACE FUNCTION public.board_minutes_import_revision(p_source text,p_source_id text,p_date date,p_title text,p_report text,p_decisions jsonb,p_actions jsonb,p_url text,p_hash text,p_details jsonb,p_source_text text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE vid uuid; fingerprint text; prior public.board_minutes_import_details; BEGIN
 IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen importeren.' USING ERRCODE='42501'; END IF;
 IF p_source_id IS NULL OR length(btrim(p_source_id)) NOT BETWEEN 1 AND 500 OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Ongeldige importbron.'; END IF;
 IF jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR length(p_details::text)>100000 OR p_source_text IS NULL OR length(p_source_text)>200000 THEN RAISE EXCEPTION 'Ongeldige brongegevens.'; END IF;
 IF p_details->>'status' NOT IN ('historisch-onbevestigd','concept') OR p_details->>'status' IS NULL OR jsonb_typeof(p_details->'reviewRequired') IS DISTINCT FROM 'boolean' OR p_details->'reviewRequired' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(p_details->'reportMissing') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Importstatus moet worden gecontroleerd.'; END IF;
 IF p_details->'reportMissing'='true'::jsonb AND btrim(p_report)<>'' THEN RAISE EXCEPTION 'Agenda is geen verslag.'; END IF;
 fingerprint:=encode(extensions.digest(convert_to(jsonb_build_object('original_hash',p_hash,'details',p_details,'source_text',p_source_text)::text,'UTF8'),'sha256'),'hex');
 vid:=public.board_minutes_save_revision(NULL,NULL,p_source,p_source_id,p_date,p_title,p_report,p_decisions,p_actions,p_url,true,fingerprint);
 SELECT * INTO prior FROM public.board_minutes_import_details WHERE version_id=vid;
 IF FOUND AND (prior.details IS DISTINCT FROM p_details OR prior.source_text IS DISTINCT FROM p_source_text) THEN RAISE EXCEPTION 'Bestaande importgegevens wijken af.'; END IF;
 INSERT INTO public.board_minutes_import_details(version_id,details,source_text,created_by) VALUES(vid,p_details,p_source_text,auth.uid()) ON CONFLICT(version_id) DO NOTHING;
 RETURN vid;
END $fn$;
REVOKE ALL ON FUNCTION public.board_minutes_import_revision(text,text,date,text,text,jsonb,jsonb,text,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.board_minutes_import_revision(text,text,date,text,text,jsonb,jsonb,text,text,jsonb,text) TO authenticated;