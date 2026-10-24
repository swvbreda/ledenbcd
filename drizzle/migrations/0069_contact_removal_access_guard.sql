CREATE TABLE public.contact_removal_operations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id integer NOT NULL,actor_id uuid NOT NULL,before_data jsonb NOT NULL,after_data jsonb NOT NULL,account_ids uuid[] NOT NULL DEFAULT '{}',emails text[] NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')),created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz);
GRANT SELECT ON public.contact_removal_operations TO authenticated;
GRANT ALL ON public.contact_removal_operations TO service_role;
ALTER TABLE public.contact_removal_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins inspect contact removal" ON public.contact_removal_operations FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX contact_removal_pending_member ON public.contact_removal_operations(member_id) WHERE status='pending';
CREATE TABLE public.account_access_revocations(user_id uuid PRIMARY KEY,operation_id uuid NOT NULL REFERENCES public.contact_removal_operations(id),revoked_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.account_access_revocations TO service_role;
ALTER TABLE public.account_access_revocations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.removed_contact_emails(member_id integer NOT NULL,email text NOT NULL,operation_id uuid NOT NULL REFERENCES public.contact_removal_operations(id),PRIMARY KEY(member_id,email));
GRANT ALL ON public.removed_contact_emails TO service_role;
ALTER TABLE public.removed_contact_emails ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.contact_email_parts(v text) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT coalesce(array_agg(DISTINCT lower(btrim(x))) FILTER(WHERE x<>''),'{}') FROM regexp_split_to_table(coalesce(v,''),'[,;/\s]+') x $$;
CREATE FUNCTION public.contact_removed_items(b jsonb,n jsonb) RETURNS SETOF jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT c FROM jsonb_array_elements(coalesce(b->'contacten','[]')) c WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(n->'contacten','[]')) d WHERE (nullif(lower(btrim(c->>'naam')),'') IS NOT NULL AND lower(btrim(c->>'naam'))=lower(btrim(d->>'naam'))) OR public.contact_email_parts(c->>'email') && public.contact_email_parts(d->>'email'))
 UNION ALL SELECT jsonb_build_object('naam',b->>'contactpersoon','email',b->>'email') WHERE nullif(btrim(b->>'contactpersoon'),'') IS NOT NULL AND nullif(btrim(n->>'contactpersoon'),'') IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(b->'contacten','[]')) c WHERE public.contact_email_parts(c->>'email') && public.contact_email_parts(b->>'email'))
 UNION ALL SELECT jsonb_build_object('naam',b->>'contactpersoon2','email',b->>'email2') WHERE nullif(btrim(b->>'contactpersoon2'),'') IS NOT NULL AND nullif(btrim(n->>'contactpersoon2'),'') IS NULL $$;
CREATE FUNCTION public.contact_access_check() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.account_access_revocations WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Toegang ingetrokken: dit contactaccount is verwijderd.' USING ERRCODE='42501'; END IF; END $$;
REVOKE ALL ON FUNCTION public.contact_access_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_access_check() TO anon,authenticated,service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request='public.contact_access_check';
NOTIFY pgrst,'reload config';
CREATE FUNCTION public.contact_removal_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE b jsonb;n jsonb;mid integer;op public.contact_removal_operations; BEGIN
 IF TG_TABLE_NAME='members_data' THEN mid:=NEW.id; ELSE mid:=NEW.member_id; END IF;
 IF TG_TABLE_NAME='members_data' THEN SELECT OLD.data || coalesce(e.data,'{}'), NEW.data || coalesce(e.data,'{}') INTO b,n FROM (SELECT 1) x LEFT JOIN public.member_edits e ON e.member_id=mid;
 ELSE SELECT m.data || CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE OLD.data END,m.data || NEW.data INTO b,n FROM public.members_data m WHERE m.id=mid; END IF;
 SELECT * INTO op FROM public.contact_removal_operations WHERE member_id=mid AND status='pending';
 IF op.id IS NOT NULL THEN IF current_setting('bcd.contact_removal',true) IS DISTINCT FROM op.id::text OR n IS DISTINCT FROM op.after_data THEN RAISE EXCEPTION 'Contactverwijdering nog niet afgerond. Probeer dezelfde verwijdering opnieuw; andere wijzigingen zijn tijdelijk geblokkeerd.'; END IF;
 ELSIF EXISTS(SELECT 1 FROM public.contact_removed_items(b,n)) THEN RAISE EXCEPTION 'Verwijder via de beveiligde contactverwijdering: ook het loginaccount en toegang moeten worden verwijderd.' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE TRIGGER zz_contact_removal_guard BEFORE INSERT OR UPDATE ON public.member_edits FOR EACH ROW EXECUTE FUNCTION public.contact_removal_guard();
CREATE TRIGGER zz_contact_removal_guard BEFORE UPDATE ON public.members_data FOR EACH ROW EXECUTE FUNCTION public.contact_removal_guard();
CREATE FUNCTION public.contact_removal_prepare(_member integer,_patch jsonb,_actor uuid,_confirm boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b jsonb;n jsonb;ov jsonb;items jsonb;es text[];ids uuid[]:='{}';c jsonb;e text;u record;op public.contact_removal_operations;cnt integer;linked integer[]; BEGIN
 IF _actor IS NULL OR NOT public.has_role(_actor,'admin') OR EXISTS(SELECT 1 FROM public.account_access_revocations WHERE user_id=_actor) THEN RAISE EXCEPTION 'Alleen een bevoegde beheerder kan contactpersonen verwijderen.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('contact-removal:'||_member,0));
 SELECT data INTO b FROM public.members_data WHERE id=_member FOR UPDATE; IF b IS NULL THEN RAISE EXCEPTION 'Lid niet gevonden.'; END IF;
 SELECT data INTO ov FROM public.member_edits WHERE member_id=_member FOR UPDATE; b:=b||coalesce(ov,'{}'); n:=b||_patch;
 SELECT * INTO op FROM public.contact_removal_operations WHERE member_id=_member AND status='pending';
 IF op.id IS NOT NULL THEN IF op.after_data IS DISTINCT FROM n OR op.actor_id<>_actor THEN RAISE EXCEPTION 'Er loopt al een andere contactverwijdering; laat de beheerder deze eerst afronden.'; END IF; RETURN jsonb_build_object('id',op.id,'account_ids',op.account_ids,'accounts',cardinality(op.account_ids),'removed',true,'retry',true); END IF;
 SELECT coalesce(jsonb_agg(x),'[]') INTO items FROM public.contact_removed_items(b,n) x; IF jsonb_array_length(items)=0 THEN RETURN jsonb_build_object('removed',false,'accounts',0); END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(items) LOOP IF cardinality(public.contact_email_parts(c->>'email'))=0 AND EXISTS(SELECT 1 FROM public.member_profiles WHERE member_id=_member) THEN RAISE EXCEPTION 'Deze contactpersoon heeft geen betrouwbare accountkoppeling. Controleer eerst het e-mailadres en gekoppelde account.'; END IF; END LOOP;
 SELECT coalesce(array_agg(DISTINCT x),'{}') INTO es FROM jsonb_array_elements(items) item CROSS JOIN LATERAL unnest(public.contact_email_parts(item->>'email')) x;
 FOREACH e IN ARRAY es LOOP SELECT count(*) INTO cnt FROM auth.users WHERE lower(btrim(email))=e AND deleted_at IS NULL;
 IF cnt>1 THEN RAISE EXCEPTION 'Meerdere accounts passen bij deze contactpersoon; automatische verwijdering is geblokkeerd.'; END IF;
 FOR u IN SELECT id,email FROM auth.users WHERE lower(btrim(email))=e AND deleted_at IS NULL LOOP
 IF u.id=_actor OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u.id AND role<>'user') OR public.is_board_member(u.id) OR EXISTS(SELECT 1 FROM public.board_members bm WHERE public.contact_email_parts(bm.email)||public.contact_email_parts(bm.bond_email) && ARRAY[e]) THEN RAISE EXCEPTION 'Eigen account, beheerder of bestuursaccount: automatische accountverwijdering is geblokkeerd.'; END IF;
 SELECT array_agg(DISTINCT mid) INTO linked FROM (SELECT member_id mid FROM public.member_profiles WHERE user_id=u.id UNION SELECT member_id FROM public.member_allowed_emails WHERE lower(btrim(email))=e UNION SELECT m.id FROM public.members_data m LEFT JOIN public.member_edits me ON me.member_id=m.id WHERE EXISTS(SELECT 1 FROM public.member_registered_emails(m.id) em WHERE em.email=e)) z;
 IF EXISTS(SELECT 1 FROM unnest(linked) x WHERE x<>_member) OR EXISTS(SELECT 1 FROM public.external_org_users WHERE user_id=u.id) THEN RAISE EXCEPTION 'Dit account is gekoppeld aan meerdere leden of een externe organisatie. Automatische globale verwijdering is geblokkeerd; beoordeel de koppelingen eerst in Accountbeheer.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.member_profiles WHERE user_id=u.id AND member_id=_member) THEN RAISE EXCEPTION 'Account gevonden, maar geen bevestigde account-id-koppeling met dit lid. Controleer Accountbeheer eerst.'; END IF; ids:=array_append(ids,u.id); END LOOP; END LOOP;
 IF NOT _confirm THEN RETURN jsonb_build_object('removed',true,'accounts',cardinality(ids),'emails',es); END IF;
 INSERT INTO public.contact_removal_operations(member_id,actor_id,before_data,after_data,account_ids,emails) VALUES(_member,_actor,b,n,ARRAY(SELECT DISTINCT unnest(ids)),es) RETURNING * INTO op;
 INSERT INTO public.account_access_revocations(user_id,operation_id) SELECT x,op.id FROM unnest(op.account_ids) x ON CONFLICT(user_id) DO NOTHING;
 RETURN jsonb_build_object('id',op.id,'account_ids',op.account_ids,'accounts',cardinality(op.account_ids),'removed',true); END $$;
REVOKE ALL ON FUNCTION public.contact_removal_prepare(integer,jsonb,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contact_removal_prepare(integer,jsonb,uuid,boolean) TO service_role;
CREATE FUNCTION public.contact_removal_finish(_id uuid,_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE op public.contact_removal_operations; BEGIN
 IF _actor IS NULL OR NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Geen beheerrechten.' USING ERRCODE='42501'; END IF;
 SELECT * INTO op FROM public.contact_removal_operations WHERE id=_id FOR UPDATE; IF op.id IS NULL OR op.actor_id<>_actor THEN RAISE EXCEPTION 'Verwijdering niet gevonden voor deze beheerder.'; END IF; IF op.status='completed' THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=ANY(op.account_ids) AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Accountverwijdering is nog niet gelukt. Contactpersoon is behouden; toegang is geblokkeerd. Probeer opnieuw.'; END IF;
 INSERT INTO public.removed_contact_emails(member_id,email,operation_id) SELECT op.member_id,x,op.id FROM unnest(op.emails) x ON CONFLICT(member_id,email) DO NOTHING;
 PERFORM set_config('bcd.contact_removal',op.id::text,true);
 INSERT INTO public.member_edits(member_id,data,updated_by,updated_at) VALUES(op.member_id,op.after_data,_actor,now()) ON CONFLICT(member_id) DO UPDATE SET data=EXCLUDED.data,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at;
 DELETE FROM public.member_allowed_emails WHERE member_id=op.member_id AND lower(btrim(email))=ANY(op.emails);
 DELETE FROM public.member_profiles WHERE user_id=ANY(op.account_ids) AND member_id=op.member_id;
 UPDATE public.contact_removal_operations SET status='completed',completed_at=now() WHERE id=op.id; END $$;
REVOKE ALL ON FUNCTION public.contact_removal_finish(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contact_removal_finish(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.sync_member_allowed_emails(_member_id integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.member_allowed_emails(member_id,email) SELECT _member_id,e.email FROM public.member_registered_emails(_member_id) e WHERE NOT EXISTS(SELECT 1 FROM public.removed_contact_emails r WHERE r.member_id=_member_id AND r.email=e.email) AND NOT EXISTS(SELECT 1 FROM public.member_allowed_emails a WHERE a.member_id=_member_id AND lower(btrim(a.email))=e.email) ON CONFLICT DO NOTHING; END $$;
CREATE FUNCTION public.removed_contact_allow_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.removed_contact_emails WHERE member_id=NEW.member_id AND email=lower(btrim(NEW.email))) THEN RAISE EXCEPTION 'Dit contactadres is verwijderd; nieuwe toegang vereist handmatige beoordeling.' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE TRIGGER removed_contact_allow_guard BEFORE INSERT OR UPDATE ON public.member_allowed_emails FOR EACH ROW EXECUTE FUNCTION public.removed_contact_allow_guard();
CREATE FUNCTION public.contact_account_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT NOT EXISTS(SELECT 1 FROM public.account_access_revocations WHERE user_id=auth.uid()) $$;
REVOKE ALL ON FUNCTION public.contact_account_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_account_active() TO anon,authenticated,service_role;
CREATE POLICY contact_account_not_revoked ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING(public.contact_account_active()) WITH CHECK(public.contact_account_active());
CREATE FUNCTION public.contact_revoked_link_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.account_access_revocations WHERE user_id=NEW.user_id) THEN RAISE EXCEPTION 'Dit account heeft ingetrokken toegang.' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE TRIGGER contact_revoked_profile_guard BEFORE INSERT OR UPDATE ON public.member_profiles FOR EACH ROW EXECUTE FUNCTION public.contact_revoked_link_guard();