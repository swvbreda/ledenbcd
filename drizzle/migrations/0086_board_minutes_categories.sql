ALTER TABLE public.board_minutes_meetings
  ADD COLUMN category text NOT NULL DEFAULT 'bestuursvergaderingen',
  ADD COLUMN subcategory text,
  ADD COLUMN date_known boolean NOT NULL DEFAULT true,
  ADD COLUMN meeting_year integer;
ALTER TABLE public.board_minutes_meetings
  ADD CONSTRAINT board_minutes_category_valid CHECK (category IN ('bestuursvergaderingen','algemene-ledenvergaderingen','gemeenten','banken','landelijk-overleg','samenwerking-pcn','experiment','werkgroep-x','regulering','keurmerk','tweede-kamer','trimbos','bestuurlijke-voorbereiding','juridisch-overleg','straatdealerscampagne','stuurgroep','overleg-contacten','overige')),
  ADD CONSTRAINT board_minutes_subcategory_valid CHECK (subcategory IS NULL OR (category='gemeenten' AND length(btrim(subcategory)) BETWEEN 1 AND 120)),
  ADD CONSTRAINT board_minutes_year_valid CHECK (meeting_year IS NULL OR meeting_year BETWEEN 1990 AND 2100);

CREATE OR REPLACE FUNCTION public.board_minutes_category_task_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN IF NEW.category<>'bestuursvergaderingen' THEN NEW.tasks_enabled:=false; END IF; RETURN NEW; END $$;
CREATE TRIGGER zz_board_minutes_category_task_guard BEFORE INSERT OR UPDATE ON public.board_minutes_meetings FOR EACH ROW EXECUTE FUNCTION public.board_minutes_category_task_guard();

CREATE OR REPLACE FUNCTION public.board_minutes_set_category(p_meeting uuid, p_category text, p_subcategory text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE m public.board_minutes_meetings; BEGIN
 IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen categorieën wijzigen.' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.board_minutes_meetings WHERE id=p_meeting FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verslag niet gevonden.'; END IF;
 IF p_category<>'bestuursvergaderingen' AND (m.tasks_enabled OR EXISTS(SELECT 1 FROM public.board_minutes_action_links WHERE meeting_id=p_meeting)) THEN RAISE EXCEPTION 'Notulen met gekoppelde taken blijven Bestuursvergaderingen.'; END IF;
 UPDATE public.board_minutes_meetings SET category=p_category, subcategory=CASE WHEN p_category='gemeenten' THEN nullif(btrim(p_subcategory),'') END WHERE id=p_meeting;
END $$;

CREATE OR REPLACE FUNCTION public.board_minutes_import_report(p_category text, p_subcategory text, p_year integer, p_date_known boolean, p_source_id text, p_date date, p_title text, p_report text, p_hash text, p_details jsonb, p_source_text text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE vid uuid; mid uuid; existed public.board_minutes_meetings; BEGIN
 IF auth.uid() IS NULL OR NOT public.contact_account_active() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders kunnen importeren.' USING ERRCODE='42501'; END IF;
 IF p_category='bestuursvergaderingen' OR p_source_id !~ '^verslag:[A-Za-z0-9._:-]{1,200}$' OR p_details->>'meetingType' IS DISTINCT FROM 'gespreksverslag' OR p_details->>'status' IS DISTINCT FROM 'historisch-onbevestigd' THEN RAISE EXCEPTION 'Ongeldig gespreksverslag.'; END IF;
 IF p_date_known AND p_year IS DISTINCT FROM extract(year FROM p_date)::int THEN RAISE EXCEPTION 'Jaar wijkt af van datum.'; END IF;
 IF NOT p_date_known AND p_date<>make_date(coalesce(p_year,1900),1,1) THEN RAISE EXCEPTION 'Onbekende datum mag niet worden ingevuld.'; END IF;
 SELECT * INTO existed FROM public.board_minutes_meetings WHERE source='onedrive' AND source_id=p_source_id;
 IF FOUND AND existed.category='bestuursvergaderingen' THEN RAISE EXCEPTION 'Bron-id hoort bij bestuursnotulen.'; END IF;
 vid:=public.board_minutes_import_revision('onedrive',p_source_id,p_date,p_title,p_report,'[]'::jsonb,'[]'::jsonb,NULL,p_hash,p_details,p_source_text);
 SELECT meeting_id INTO mid FROM public.board_minutes_versions WHERE id=vid;
 IF existed.id IS NULL THEN
  UPDATE public.board_minutes_meetings SET category=p_category, subcategory=CASE WHEN p_category='gemeenten' THEN nullif(btrim(p_subcategory),'') END, date_known=p_date_known, meeting_year=p_year, tasks_enabled=false WHERE id=mid;
 END IF;
 RETURN vid;
END $$;
REVOKE ALL ON FUNCTION public.board_minutes_set_category(uuid,text,text), public.board_minutes_import_report(text,text,integer,boolean,text,date,text,text,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_minutes_set_category(uuid,text,text), public.board_minutes_import_report(text,text,integer,boolean,text,date,text,text,text,jsonb,text) TO authenticated;