CREATE TABLE public.whatsapp_announcement_publishers (phone text PRIMARY KEY CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),enabled boolean NOT NULL DEFAULT false,authorized_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.whatsapp_announcement_publishers TO authenticated;
GRANT ALL ON public.whatsapp_announcement_publishers TO service_role;
ALTER TABLE public.whatsapp_announcement_publishers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read explicit publishers" ON public.whatsapp_announcement_publishers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.whatsapp_announcement_decisions (wa_message_id text PRIMARY KEY,decision text NOT NULL,announcement_id uuid UNIQUE,decided_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.whatsapp_announcement_decisions TO authenticated;
GRANT ALL ON public.whatsapp_announcement_decisions TO service_role;
ALTER TABLE public.whatsapp_announcement_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read publication decisions" ON public.whatsapp_announcement_decisions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.whatsapp_set_publisher(p_phone text,p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF p_phone !~ '^\+[1-9][0-9]{7,14}$' OR p_phone IS NULL THEN RAISE EXCEPTION 'International phone required'; END IF;
INSERT INTO public.whatsapp_announcement_publishers(phone,enabled,authorized_by) VALUES(p_phone,p_enabled,auth.uid()) ON CONFLICT(phone) DO UPDATE SET enabled=EXCLUDED.enabled,authorized_by=auth.uid(),updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.whatsapp_set_publisher(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_set_publisher(text,boolean) TO authenticated;
CREATE FUNCTION public.whatsapp_publish_forwarded(p_message jsonb,p_recipient text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id text:=p_message->>'id'; v_phone text; v_author uuid; v_body text; v_title text; v_decision text; v_announcement uuid;
BEGIN
IF v_id IS NULL OR length(v_id) NOT BETWEEN 1 AND 512 THEN RETURN; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(v_id,0));
IF EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id=v_id) THEN RETURN; END IF;
IF NOT EXISTS(SELECT 1 FROM public.whatsapp_messages WHERE wa_message_id=v_id AND direction='inbound' AND phone=p_message->>'from') THEN RETURN; END IF;
v_phone:='+'||(p_message->>'from'); v_body:=p_message #>> '{text,body}';
SELECT authorized_by INTO v_author FROM public.whatsapp_announcement_publishers WHERE phone=v_phone AND enabled FOR SHARE;
v_decision:=CASE
WHEN p_recipient IS DISTINCT FROM '1312061225331302' THEN 'wrong_recipient'
WHEN v_author IS NULL THEN 'not_allowed'
WHEN NOT public.has_role(v_author,'admin') THEN 'inactive_admin'
WHEN p_message->>'type' IN ('image','video','audio','document','sticker') THEN 'attachment'
WHEN p_message->>'type' IS DISTINCT FROM 'text' THEN 'ignored'
WHEN NOT (COALESCE(p_message #> '{context,forwarded}','false'::jsonb)='true'::jsonb OR COALESCE(p_message #> '{context,frequently_forwarded}','false'::jsonb)='true'::jsonb) THEN 'not_forwarded'
WHEN v_body IS NULL OR length(btrim(v_body))=0 OR length(v_body)>5000 THEN 'invalid_text'
ELSE 'published' END;
IF v_decision='published' THEN
SELECT left(line,160) INTO v_title FROM regexp_split_to_table(v_body,E'\r?\n') WITH ORDINALITY AS t(line,n) WHERE length(btrim(line))>0 ORDER BY n LIMIT 1;
v_announcement:=gen_random_uuid(); END IF;
INSERT INTO public.whatsapp_announcement_decisions(wa_message_id,decision,announcement_id) VALUES(v_id,v_decision,v_announcement);
IF v_decision='published' THEN INSERT INTO public.member_announcements(id,title,body,published,created_by) VALUES(v_announcement,v_title,v_body,true,v_author); END IF;
END; $$;
REVOKE ALL ON FUNCTION public.whatsapp_publish_forwarded(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_publish_forwarded(jsonb,text) TO service_role;
CREATE FUNCTION public.whatsapp_connector_publish() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE m jsonb; BEGIN
IF NEW.event='whatsapp.message' AND NEW.processed_at IS NOT NULL AND OLD.processed_at IS NULL THEN
FOR m IN SELECT value FROM jsonb_array_elements(NEW.payload #> '{entry,0,changes,0,value,messages}') LOOP
PERFORM public.whatsapp_publish_forwarded(m,NEW.payload #>> '{entry,0,changes,0,value,metadata,phone_number_id}'); END LOOP; END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.whatsapp_connector_publish() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER whatsapp_connector_publish AFTER UPDATE ON public.whatsapp_webhook_events FOR EACH ROW EXECUTE FUNCTION public.whatsapp_connector_publish();
CREATE FUNCTION public.whatsapp_ingest_verified(p_message jsonb,p_recipient text,p_parsed jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF p_message->>'id' IS DISTINCT FROM p_parsed->>'waMessageId' OR p_message->>'from' IS DISTINCT FROM p_parsed->>'waId' THEN RAISE EXCEPTION 'Message mismatch'; END IF;
PERFORM public.whatsapp_ingest_message(p_parsed->>'waId',p_parsed->>'profileName',p_parsed->>'waMessageId',p_parsed->>'messageType',p_parsed->>'body',p_parsed->>'mediaMimeType',(p_parsed->>'sentAt')::timestamptz,left(p_parsed->>'body',140));
PERFORM public.whatsapp_publish_forwarded(p_message,p_recipient); END; $$;
REVOKE ALL ON FUNCTION public.whatsapp_ingest_verified(jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ingest_verified(jsonb,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.prepare_member_announcement() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF TG_OP='UPDATE' THEN NEW.created_by:=OLD.created_by; END IF;
NEW.title:=btrim(NEW.title);
IF NOT EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE announcement_id=NEW.id AND decision='published') THEN NEW.body:=btrim(NEW.body); END IF;
NEW.link_url:=NULLIF(btrim(NEW.link_url),''); NEW.updated_at:=now();
IF NEW.published=true AND (TG_OP='INSERT' OR OLD.published=false) THEN NEW.published_at:=now(); ELSIF NEW.published=false THEN NEW.published_at:=NULL; END IF; RETURN NEW; END; $$;
COMMENT ON TABLE public.whatsapp_announcement_publishers IS 'Empty by default. Explicit admin consent only. Fixed recipient is the verified linked BCD connector phone_number_id, never a publisher number.';
COMMENT ON TABLE public.whatsapp_announcement_decisions IS 'Private immutable publication/dedup ledger; no retroactive publication on allowlist changes. Announcement deletion does not permit replay.';