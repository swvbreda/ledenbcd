ALTER TABLE public.whatsapp_announcement_decisions
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS media_id text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS author uuid;

CREATE TABLE public.member_announcement_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL UNIQUE REFERENCES public.member_announcements(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  file_name text CHECK (file_name IS NULL OR char_length(file_name) <= 240),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.member_announcement_attachments TO authenticated;
GRANT ALL ON public.member_announcement_attachments TO service_role;
ALTER TABLE public.member_announcement_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Readers of announcement read its attachment" ON public.member_announcement_attachments
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.member_announcements a WHERE a.id = announcement_id AND (
      (a.published AND (public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid())))
      OR public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()))));

CREATE POLICY "Readers of announcement read its media" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'announcement-media' AND EXISTS (
    SELECT 1 FROM public.member_announcement_attachments t JOIN public.member_announcements a ON a.id = t.announcement_id
    WHERE t.storage_path = storage.objects.name AND (
      (a.published AND (public.has_role(auth.uid(),'user') OR public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid())))
      OR public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()))));

CREATE OR REPLACE FUNCTION public.whatsapp_publish_forwarded(p_message jsonb, p_recipient text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_id text:=p_message->>'id'; v_phone text; v_author uuid; v_body text; v_title text; v_decision text; v_announcement uuid;
  v_type text:=p_message->>'type'; v_media jsonb; v_forwarded boolean;
BEGIN
IF v_id IS NULL OR length(v_id) NOT BETWEEN 1 AND 512 THEN RETURN; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(v_id,0));
IF EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id=v_id) THEN RETURN; END IF;
IF NOT EXISTS(SELECT 1 FROM public.whatsapp_messages WHERE wa_message_id=v_id AND direction='inbound' AND phone=p_message->>'from') THEN RETURN; END IF;
v_phone:='+'||(p_message->>'from'); v_body:=p_message #>> '{text,body}';
v_forwarded:=COALESCE(p_message #> '{context,forwarded}','false'::jsonb)='true'::jsonb OR COALESCE(p_message #> '{context,frequently_forwarded}','false'::jsonb)='true'::jsonb;
v_media:=CASE WHEN v_type IN ('image','document') THEN p_message->v_type END;
SELECT authorized_by INTO v_author FROM public.whatsapp_announcement_publishers WHERE phone=v_phone AND enabled FOR SHARE;
v_decision:=CASE
WHEN p_recipient IS DISTINCT FROM '1312061225331302' THEN 'wrong_recipient'
WHEN v_author IS NULL THEN 'not_allowed'
WHEN NOT public.has_role(v_author,'admin') THEN 'inactive_admin'
WHEN v_type IN ('image','video','audio','document','sticker') AND NOT v_forwarded THEN 'not_forwarded'
WHEN v_type IN ('image','document') AND v_media->>'id' IS NOT NULL
  AND split_part(v_media->>'mime_type',';',1) IN ('image/jpeg','image/png','application/pdf')
  AND length(COALESCE(v_media->>'caption','')) <= 5000 THEN 'attachment_pending'
WHEN v_type IN ('image','video','audio','document','sticker') THEN 'attachment'
WHEN v_type IS DISTINCT FROM 'text' THEN 'ignored'
WHEN NOT v_forwarded THEN 'not_forwarded'
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

CREATE OR REPLACE FUNCTION public.whatsapp_attachment_claim(p_limit integer DEFAULT 1)
RETURNS TABLE(wa_message_id text, media_id text, media_mime text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
RETURN QUERY UPDATE public.whatsapp_announcement_decisions d SET attempts=d.attempts+1, decided_at=now()
WHERE d.wa_message_id IN (SELECT x.wa_message_id FROM public.whatsapp_announcement_decisions x
  WHERE x.decision='attachment_pending' AND x.attempts<5 AND (x.attempts=0 OR x.decided_at < now()-interval '2 minutes')
  ORDER BY x.attempts, x.decided_at LIMIT LEAST(GREATEST(p_limit,1),3) FOR UPDATE SKIP LOCKED)
RETURNING d.wa_message_id, d.media_id, d.media_mime;
END; $fn$;

CREATE OR REPLACE FUNCTION public.whatsapp_attachment_complete(p_id text, p_path text, p_sha256 text, p_size integer, p_mime text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE d public.whatsapp_announcement_decisions%ROWTYPE; v_body text; v_title text; v_ann uuid:=gen_random_uuid();
BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(p_id,0));
SELECT * INTO d FROM public.whatsapp_announcement_decisions WHERE wa_message_id=p_id FOR UPDATE;
IF NOT FOUND OR d.decision<>'attachment_pending' THEN RETURN COALESCE(d.decision,'missing'); END IF;
IF p_mime IS DISTINCT FROM d.media_mime THEN
  UPDATE public.whatsapp_announcement_decisions SET decision='attachment', last_error='mime_mismatch' WHERE wa_message_id=p_id; RETURN 'attachment'; END IF;
IF d.author IS NULL OR NOT public.has_role(d.author,'admin') OR NOT EXISTS (SELECT 1 FROM public.whatsapp_announcement_publishers p WHERE p.authorized_by=d.author AND p.enabled AND p.phone='+'||(SELECT m.phone FROM public.whatsapp_messages m WHERE m.wa_message_id=p_id AND m.direction='inbound')) THEN
  UPDATE public.whatsapp_announcement_decisions SET decision='not_allowed' WHERE wa_message_id=p_id; RETURN 'not_allowed'; END IF;
v_body:=NULLIF(btrim(COALESCE(d.caption,'')),'');
IF v_body IS NULL THEN v_body:=NULLIF(btrim(COALESCE(d.file_name,'')),''); END IF;
IF v_body IS NULL THEN
  UPDATE public.whatsapp_announcement_decisions SET decision='attachment_no_caption' WHERE wa_message_id=p_id; RETURN 'attachment_no_caption'; END IF;
SELECT left(line,160) INTO v_title FROM regexp_split_to_table(v_body,E'\r?\n') WITH ORDINALITY AS t(line,n) WHERE length(btrim(line))>0 ORDER BY n LIMIT 1;
UPDATE public.whatsapp_announcement_decisions SET decision='published', announcement_id=v_ann, last_error=NULL WHERE wa_message_id=p_id;
INSERT INTO public.member_announcements(id,title,body,published,created_by) VALUES(v_ann,v_title,v_body,true,d.author);
INSERT INTO public.member_announcement_attachments(announcement_id,storage_path,mime_type,file_name,size_bytes,sha256)
  VALUES(v_ann,p_path,p_mime,d.file_name,p_size,p_sha256);
RETURN 'published';
END; $fn$;

CREATE OR REPLACE FUNCTION public.whatsapp_attachment_fail(p_id text, p_error text, p_final boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
UPDATE public.whatsapp_announcement_decisions SET last_error=left(p_error,200),
  decision=CASE WHEN p_final OR attempts>=5 THEN 'attachment_failed' ELSE decision END
WHERE wa_message_id=p_id AND decision='attachment_pending';
END; $fn$;

REVOKE ALL ON FUNCTION public.whatsapp_attachment_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_attachment_complete(text,text,text,integer,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_attachment_fail(text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_publish_forwarded(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_attachment_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_attachment_complete(text,text,text,integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_attachment_fail(text,text,boolean) TO service_role;