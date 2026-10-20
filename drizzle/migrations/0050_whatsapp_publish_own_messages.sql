CREATE OR REPLACE FUNCTION public.whatsapp_publish_forwarded(p_message jsonb, p_recipient text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
-- Explicit owner decision (2026-10-20): every text/attachment from an explicitly allowed publisher
-- is published, forwarded or not (WhatsApp never marks one's own messages as forwarded).
DECLARE v_id text:=p_message->>'id'; v_phone text; v_author uuid; v_body text; v_title text; v_decision text; v_announcement uuid;
  v_type text:=p_message->>'type'; v_media jsonb;
BEGIN
IF v_id IS NULL OR length(v_id) NOT BETWEEN 1 AND 512 THEN RETURN; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(v_id,0));
IF EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id=v_id) THEN RETURN; END IF;
IF NOT EXISTS(SELECT 1 FROM public.whatsapp_messages WHERE wa_message_id=v_id AND direction='inbound' AND phone=p_message->>'from') THEN RETURN; END IF;
v_phone:='+'||(p_message->>'from'); v_body:=p_message #>> '{text,body}';
v_media:=CASE WHEN v_type IN ('image','document') THEN p_message->v_type END;
SELECT authorized_by INTO v_author FROM public.whatsapp_announcement_publishers WHERE phone=v_phone AND enabled FOR SHARE;
v_decision:=CASE
WHEN p_recipient IS DISTINCT FROM '1312061225331302' THEN 'wrong_recipient'
WHEN v_author IS NULL THEN 'not_allowed'
WHEN NOT public.has_role(v_author,'admin') THEN 'inactive_admin'
WHEN v_type IN ('image','document') AND v_media->>'id' IS NOT NULL
  AND split_part(v_media->>'mime_type',';',1) IN ('image/jpeg','image/png','application/pdf')
  AND length(COALESCE(v_media->>'caption','')) <= 5000 THEN 'attachment_pending'
WHEN v_type IN ('image','video','audio','document','sticker') THEN 'attachment'
WHEN v_type IS DISTINCT FROM 'text' THEN 'ignored'
WHEN v_body IS NULL OR length(btrim(v_body))=0 OR length(v_body)>5000 THEN 'invalid_text'
ELSE 'published' END;
IF v_decision='attachment_pending' THEN
  INSERT INTO public.whatsapp_announcement_decisions(wa_message_id,decision,media_id,media_mime,caption,file_name,author)
  VALUES(v_id,v_decision,v_media->>'id',split_part(v_media->>'mime_type',';',1),v_media->>'caption',left(v_media->>'filename',240),v_author);
  RETURN;
END IF;
IF v_decision='published' THEN
SELECT left(line,160) INTO v_title FROM regexp_split_to_table(v_body,E'\r?\n') WITH ORDINALITY AS t(line,n) WHERE length(btrim(line))>0 ORDER BY n LIMIT 1;
v_announcement:=gen_random_uuid(); END IF;
INSERT INTO public.whatsapp_announcement_decisions(wa_message_id,decision,announcement_id) VALUES(v_id,v_decision,v_announcement);
IF v_decision='published' THEN INSERT INTO public.member_announcements(id,title,body,published,created_by) VALUES(v_announcement,v_title,v_body,true,v_author); END IF;
END; $fn$;
REVOKE ALL ON FUNCTION public.whatsapp_publish_forwarded(jsonb,text) FROM PUBLIC, anon, authenticated;