-- Schema and functions only; no minutes, identities, or live task data.
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS board_minutes_private boolean NOT NULL DEFAULT false;
ALTER TABLE public.board_minutes_meetings ADD COLUMN IF NOT EXISTS tasks_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.board_minutes_action_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id uuid NOT NULL REFERENCES public.board_minutes_meetings(id),
 task_id uuid UNIQUE REFERENCES public.internal_tasks(id), created_at timestamptz NOT NULL DEFAULT now(),
 needs_assignment boolean NOT NULL DEFAULT true, manual_assignment boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.board_minutes_action_links TO authenticated;
GRANT ALL ON public.board_minutes_action_links TO service_role;
ALTER TABLE public.board_minutes_action_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY minutes_actions_read ON public.board_minutes_action_links FOR SELECT TO authenticated USING(public.board_minutes_can_read());
CREATE TABLE public.board_minutes_action_versions (
 version_id uuid NOT NULL REFERENCES public.board_minutes_versions(id), row_index integer NOT NULL CHECK(row_index>=0),
 action_id uuid NOT NULL REFERENCES public.board_minutes_action_links(id), action text NOT NULL CHECK(length(btrim(action)) BETWEEN 1 AND 200),
 owner text NOT NULL, deadline text NOT NULL, PRIMARY KEY(version_id,row_index), UNIQUE(version_id,action_id)
);
GRANT SELECT ON public.board_minutes_action_versions TO authenticated;
GRANT ALL ON public.board_minutes_action_versions TO service_role;
ALTER TABLE public.board_minutes_action_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY minutes_action_versions_read ON public.board_minutes_action_versions FOR SELECT TO authenticated USING(public.board_minutes_can_read());
CREATE TABLE public.board_minutes_action_assignees (
 action_id uuid NOT NULL REFERENCES public.board_minutes_action_links(id), user_id uuid NOT NULL,
 PRIMARY KEY(action_id,user_id)
);
GRANT SELECT ON public.board_minutes_action_assignees TO authenticated;
GRANT ALL ON public.board_minutes_action_assignees TO service_role;
ALTER TABLE public.board_minutes_action_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY minutes_action_assignees_read ON public.board_minutes_action_assignees FOR SELECT TO authenticated USING(public.board_minutes_can_read());

CREATE FUNCTION public.board_minutes_task_staff() RETURNS TABLE(user_id uuid,name text,aliases text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u.id, coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),b.name,u.email::text),
 ARRAY[lower(btrim(u.raw_user_meta_data->>'full_name')),lower(b.name),lower(split_part(b.name,' ',1))]
 FROM auth.users u LEFT JOIN LATERAL (
 SELECT CASE WHEN count(DISTINCT btrim(naam))=1 THEN min(btrim(naam)) END name FROM public.board_members
 WHERE lower(btrim(email))=lower(u.email::text) OR lower(btrim(bond_email))=lower(u.email::text)
 ) b ON true
 WHERE u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now())
 AND public.has_role(u.id,'admin') AND NOT EXISTS(SELECT 1 FROM public.account_access_revocations r WHERE r.user_id=u.id)
$$;
REVOKE ALL ON FUNCTION public.board_minutes_task_staff() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.board_minutes_task_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.board_minutes_private IS DISTINCT FROM OLD.board_minutes_private
 AND EXISTS(SELECT 1 FROM public.board_minutes_action_links WHERE task_id=OLD.id) THEN RAISE EXCEPTION 'Privé taakbinding is onveranderlijk.'; END IF;
 IF NEW.board_minutes_private AND (NEW.project_id IS NOT NULL OR NEW.source_system IS NOT NULL) THEN RAISE EXCEPTION 'Bestuursactie mag niet naar projecten of Microsoft.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER board_minutes_task_guard BEFORE INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.board_minutes_task_guard();

CREATE OR REPLACE FUNCTION public.internal_task_assignment_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.board_minutes_private OR current_setting('bcd.ms_import',true)='on' THEN RETURN NULL; END IF;
 IF NEW.assignee_id IS NULL THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN RETURN NULL; END IF;
 IF NEW.status='afgerond' OR NEW.assignee_id=auth.uid() OR NOT public.has_role(NEW.assignee_id,'admin') THEN RETURN NULL; END IF;
 INSERT INTO public.task_notifications(recipient_id,task_id,event_key) VALUES(NEW.assignee_id,NEW.id,NEW.id::text||':'||NEW.assignee_id::text||':'||txid_current()::text) ON CONFLICT(event_key) DO NOTHING;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.outlook_deadline_task_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.board_minutes_private THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' OR ROW(NEW.title,NEW.deadline,NEW.assignee_id,NEW.status,NEW.project_id) IS DISTINCT FROM ROW(OLD.title,OLD.deadline,OLD.assignee_id,OLD.status,OLD.project_id) THEN PERFORM public.outlook_deadline_enqueue(NEW.id); END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.board_minutes_sync_tasks(p_version uuid,p_activate boolean DEFAULT false) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.board_minutes_versions; m public.board_minutes_meetings; rows jsonb; r jsonb; aid uuid; tid uuid;
 i integer:=0; n integer; prior uuid; part text; people uuid[]; matches uuid[]; unresolved boolean; explicit_id uuid; oldrow public.board_minutes_action_versions;
BEGIN
 IF auth.uid() IS NULL OR NOT public.board_minutes_can_read() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders.' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.board_minutes_versions WHERE id=p_version;
 SELECT * INTO m FROM public.board_minutes_meetings WHERE id=v.meeting_id FOR UPDATE;
 IF m.id IS NULL OR v.id IS DISTINCT FROM (SELECT id FROM public.board_minutes_versions WHERE meeting_id=m.id ORDER BY version DESC LIMIT 1) THEN RAISE EXCEPTION 'Vernieuw naar de nieuwste versie.' USING ERRCODE='40001'; END IF;
 IF m.source<>'upload' OR v.meeting_date<'2026-11-06' OR EXISTS(SELECT 1 FROM public.board_minutes_adoptions WHERE version_id=v.id)
 OR EXISTS(SELECT 1 FROM public.board_minutes_import_details WHERE version_id=v.id AND (details->>'status'='historisch-onbevestigd' OR details->>'reportMissing'='true')) THEN RETURN 0; END IF;
 IF p_activate THEN
   IF m.id<>'f9c3a642-13e8-42bd-891e-07495be20312' AND NOT m.tasks_enabled THEN RAISE EXCEPTION 'Bestaand archief wordt niet geactiveerd.'; END IF;
   UPDATE public.board_minutes_meetings SET tasks_enabled=true WHERE id=m.id; m.tasks_enabled:=true;
 END IF;
 IF NOT m.tasks_enabled THEN RETURN 0; END IF;
 SELECT details->'action_rows' INTO rows FROM public.board_minutes_import_details WHERE version_id=v.id;
 IF rows IS NULL THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('action_id',av.action_id,'action',x.value,'owner',coalesce(av.owner,''),'deadline',coalesce(av.deadline,'')) ORDER BY x.ordinality),'[]') INTO rows
   FROM jsonb_array_elements_text(v.actions) WITH ORDINALITY x(value,ordinality)
   LEFT JOIN public.board_minutes_action_versions av ON av.version_id=(SELECT id FROM public.board_minutes_versions WHERE meeting_id=m.id AND version<v.version ORDER BY version DESC LIMIT 1) AND av.row_index=x.ordinality-1 AND av.action=x.value;
 END IF;
 IF jsonb_typeof(rows)<>'array' OR jsonb_array_length(rows)>200 THEN RAISE EXCEPTION 'Ongeldige actierijen.'; END IF;
 SELECT id INTO prior FROM public.board_minutes_versions WHERE meeting_id=m.id AND version<v.version ORDER BY version DESC LIMIT 1;
 FOR r IN SELECT value FROM jsonb_array_elements(rows) LOOP
   IF length(btrim(coalesce(r->>'action',''))) NOT BETWEEN 1 AND 200 OR length(coalesce(r->>'owner',''))>1000 OR length(coalesce(r->>'deadline',''))>1000 THEN RAISE EXCEPTION 'Ongeldige actie.'; END IF;
   SELECT action_id INTO aid FROM public.board_minutes_action_versions WHERE version_id=v.id AND row_index=i;
   IF aid IS NOT NULL THEN i:=i+1; CONTINUE; END IF;
   explicit_id:=nullif(r->>'action_id','')::uuid;
   aid:=NULL;
   IF explicit_id IS NOT NULL THEN
     SELECT id INTO aid FROM public.board_minutes_action_links WHERE id=explicit_id AND meeting_id=m.id;
     IF aid IS NULL AND EXISTS(SELECT 1 FROM public.board_minutes_action_links WHERE id=explicit_id) THEN RAISE EXCEPTION 'Actie-id hoort bij andere vergadering.'; END IF;
   ELSE
     SELECT count(*),min(av.action_id::text)::uuid INTO n,aid FROM public.board_minutes_action_versions av WHERE av.version_id=prior AND av.action=r->>'action';
     IF n>1 THEN RAISE EXCEPTION 'Dubbele actie: kies expliciete actie-id.'; END IF;
     IF n=0 AND EXISTS(SELECT 1 FROM public.board_minutes_action_versions WHERE version_id=prior) THEN
       SELECT * INTO oldrow FROM public.board_minutes_action_versions WHERE version_id=prior AND row_index=i;
       IF FOUND AND oldrow.action IS DISTINCT FROM r->>'action' THEN RAISE EXCEPTION 'Gewijzigde actie vereist bestaande actie-id; geen gok op rijpositie.'; END IF;
     END IF;
   END IF;
   IF aid IS NULL THEN
     aid:=coalesce(explicit_id,gen_random_uuid()); tid:=NULL;
     PERFORM pg_advisory_xact_lock(hashtext(lower(btrim(r->>'action'))));
     SELECT count(*),min(t.id::text)::uuid INTO n,tid FROM public.internal_tasks t
     WHERE lower(btrim(t.title))=lower(btrim(r->>'action')) AND NOT EXISTS(SELECT 1 FROM public.board_minutes_action_links l WHERE l.task_id=t.id);
     IF n>1 THEN RAISE EXCEPTION 'Meerdere exact passende taken; beheerder moet eerst kiezen.'; END IF;
     IF n=1 AND EXISTS(SELECT 1 FROM public.internal_tasks t WHERE t.id=tid AND (t.project_id IS NOT NULL OR t.source_system IS NOT NULL OR EXISTS(SELECT 1 FROM public.planner_task_links p WHERE p.task_id=t.id) OR EXISTS(SELECT 1 FROM public.outlook_deadline_outbox o WHERE o.task_id=t.id))) THEN RAISE EXCEPTION 'Bestaande taak heeft externe/projectbinding; eerst veilig beoordelen.'; END IF;
     IF tid IS NULL THEN INSERT INTO public.internal_tasks(title,board_minutes_private,created_by) VALUES(r->>'action',true,auth.uid()) RETURNING id INTO tid;
     ELSE UPDATE public.internal_tasks SET board_minutes_private=true WHERE id=tid; END IF;
     INSERT INTO public.board_minutes_action_links(id,meeting_id,task_id) VALUES(aid,m.id,tid);
   END IF;
   INSERT INTO public.board_minutes_action_versions(version_id,row_index,action_id,action,owner,deadline) VALUES(v.id,i,aid,r->>'action',coalesce(r->>'owner',''),coalesce(r->>'deadline',''));
   SELECT task_id INTO tid FROM public.board_minutes_action_links WHERE id=aid;
   IF NOT (SELECT manual_assignment FROM public.board_minutes_action_links WHERE id=aid) THEN
     people:='{}'; unresolved:=false;
     FOR part IN SELECT btrim(x) FROM regexp_split_to_table(coalesce(r->>'owner',''),'\s*(\+|,|;| en | & )\s*','i') x LOOP
       SELECT array_agg(user_id) INTO matches FROM public.board_minutes_task_staff() WHERE lower(part)=ANY(aliases);
       IF cardinality(matches)=1 THEN people:=array_append(people,matches[1]); ELSE unresolved:=true; END IF;
     END LOOP;
     DELETE FROM public.board_minutes_action_assignees WHERE action_id=aid;
     INSERT INTO public.board_minutes_action_assignees SELECT aid,x FROM (SELECT DISTINCT unnest(people) x) s;
     UPDATE public.board_minutes_action_links SET needs_assignment=unresolved OR cardinality(people)=0 WHERE id=aid;
     -- Existing task completion and deadline are never reset by import; only exact supplied dates on new tasks.
     UPDATE public.internal_tasks SET assignee_id=people[1] WHERE id=tid AND assignee_id IS NULL AND cardinality(people)>0;
   END IF;
   i:=i+1;
 END LOOP;
 RETURN i;
END $$;
REVOKE ALL ON FUNCTION public.board_minutes_sync_tasks(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.board_minutes_sync_tasks(uuid,boolean) TO authenticated;

CREATE FUNCTION public.board_minutes_new_task_scope() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.tasks_enabled:=NEW.source='upload'; RETURN NEW; END $$;
CREATE TRIGGER board_minutes_new_task_scope BEFORE INSERT ON public.board_minutes_meetings FOR EACH ROW EXECUTE FUNCTION public.board_minutes_new_task_scope();
CREATE FUNCTION public.board_minutes_auto_tasks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid;
BEGIN
 IF TG_TABLE_NAME='board_minutes_versions' THEN vid:=NEW.id; ELSE vid:=NEW.version_id; END IF;
 IF EXISTS(SELECT 1 FROM public.board_minutes_versions v JOIN public.board_minutes_meetings m ON m.id=v.meeting_id WHERE v.id=vid AND m.tasks_enabled AND v.id=(SELECT id FROM public.board_minutes_versions WHERE meeting_id=m.id ORDER BY version DESC LIMIT 1)) THEN PERFORM public.board_minutes_sync_tasks(vid,false); END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER board_minutes_auto_tasks AFTER INSERT ON public.board_minutes_versions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.board_minutes_auto_tasks();
CREATE CONSTRAINT TRIGGER board_minutes_import_auto_tasks AFTER INSERT ON public.board_minutes_import_details DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.board_minutes_auto_tasks();

CREATE FUNCTION public.board_minutes_task_assignment(p_action uuid,p_users uuid[],p_confirm boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.board_minutes_action_links;
BEGIN
 IF auth.uid() IS NULL OR NOT public.board_minutes_can_read() OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Alleen beheerders.' USING ERRCODE='42501'; END IF;
 IF p_confirm IS DISTINCT FROM true OR p_users IS NULL OR cardinality(p_users)>30 OR EXISTS(SELECT 1 FROM unnest(p_users) u WHERE NOT EXISTS(SELECT 1 FROM public.board_minutes_task_staff() s WHERE s.user_id=u)) THEN RAISE EXCEPTION 'Kies actieve interne medewerkers.'; END IF;
 SELECT * INTO l FROM public.board_minutes_action_links WHERE id=p_action FOR UPDATE;
 IF l.task_id IS NULL THEN RAISE EXCEPTION 'Taak ontbreekt.'; END IF;
 DELETE FROM public.board_minutes_action_assignees WHERE action_id=p_action;
 INSERT INTO public.board_minutes_action_assignees SELECT p_action,u FROM (SELECT DISTINCT unnest(p_users) u) s;
 UPDATE public.board_minutes_action_links SET manual_assignment=true,needs_assignment=cardinality(p_users)=0 WHERE id=p_action;
 UPDATE public.internal_tasks SET assignee_id=p_users[1] WHERE id=l.task_id;
END $$;
REVOKE ALL ON FUNCTION public.board_minutes_task_assignment(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.board_minutes_task_assignment(uuid,uuid[],boolean) TO authenticated;

CREATE FUNCTION public.board_minutes_tasks(p_version uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; enabled boolean; admin boolean;
BEGIN
 IF NOT coalesce(public.board_minutes_can_read(),false) THEN RAISE EXCEPTION 'Geen toegang.' USING ERRCODE='42501'; END IF;
 admin:=public.has_role(auth.uid(),'admin');
 SELECT m.tasks_enabled INTO enabled FROM public.board_minutes_versions v JOIN public.board_minutes_meetings m ON m.id=v.meeting_id WHERE v.id=p_version;
 SELECT coalesce(jsonb_agg(jsonb_build_object('action_id',av.action_id,'row_index',av.row_index,'action',av.action,'owner',av.owner,'deadline',av.deadline,'task_id',t.id,'status',t.status,'needs_assignment',l.needs_assignment,'assignees',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',s.user_id,'name',s.name)) FROM public.board_minutes_task_staff() s WHERE s.user_id=t.assignee_id OR EXISTS(SELECT 1 FROM public.board_minutes_action_assignees a WHERE a.action_id=l.id AND a.user_id=s.user_id)),'[]'),'completed_by',t.completed_by,'completed_name',(SELECT s.name FROM public.board_minutes_task_staff() s WHERE s.user_id=t.completed_by),'completed_at',t.completed_at) ORDER BY av.row_index),'[]') INTO result
 FROM public.board_minutes_action_versions av JOIN public.board_minutes_action_links l ON l.id=av.action_id JOIN public.internal_tasks t ON t.id=l.task_id WHERE av.version_id=p_version AND t.board_minutes_private;
 RETURN jsonb_build_object('enabled',coalesce(enabled,false),'can_manage',admin,'rows',result,'staff',CASE WHEN admin THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'name',name)),'[]') FROM public.board_minutes_task_staff()) ELSE '[]'::jsonb END);
END $$;
REVOKE ALL ON FUNCTION public.board_minutes_tasks(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.board_minutes_tasks(uuid) TO authenticated;