-- Reserved link command: anything that starts with "BCD-" followed by only letters/digits (valid, expired or malformed).
CREATE OR REPLACE FUNCTION public.whatsapp_is_link_command(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(upper(btrim(p_text)) ~ '^BCD-[A-Z0-9]{1,32}$', false)
$$;
GRANT EXECUTE ON FUNCTION public.whatsapp_is_link_command(text) TO authenticated, service_role;

-- Own-member helper for RLS; the generic per-uid lookup becomes definer/service-only.
CREATE OR REPLACE FUNCTION public.support_my_member_id()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.support_member_id(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.support_my_member_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_my_member_id() TO authenticated;

DROP POLICY "Owner active member or admin" ON public.support_threads;
CREATE POLICY "Owner active member or admin" ON public.support_threads FOR SELECT TO authenticated
  USING ((user_id = auth.uid() AND public.support_my_member_id() IS NOT NULL) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY "Support upload own thread folder" ON storage.objects;
CREATE POLICY "Support upload own thread folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('pdf','jpg','png')
    AND EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id::text = (storage.foldername(name))[1]
      AND (public.has_role(auth.uid(), 'admin') OR (t.user_id = auth.uid() AND public.support_my_member_id() IS NOT NULL))));
REVOKE EXECUTE ON FUNCTION public.support_member_id(uuid) FROM authenticated;

-- Publication guard: a link command is never published, whatever the code's validity or sender.
CREATE OR REPLACE FUNCTION public.whatsapp_publish_forwarded(p_message jsonb, p_recipient text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id text:=p_message->>'id'; v_phone text; v_author uuid; v_body text; v_title text; v_decision text; v_announcement uuid;
  v_type text:=p_message->>'type'; v_media jsonb;
BEGIN
IF v_id IS NULL OR length(v_id) NOT BETWEEN 1 AND 512 THEN RETURN; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(v_id,0));
IF EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id=v_id) THEN RETURN; END IF;
IF NOT EXISTS(SELECT 1 FROM public.whatsapp_messages WHERE wa_message_id=v_id AND direction='inbound' AND phone=p_message->>'from') THEN RETURN; END IF;
v_body:=p_message #>> '{text,body}';
v_media:=CASE WHEN v_type IN ('image','document') THEN p_message->v_type END;
IF public.whatsapp_is_link_command(v_body) OR public.whatsapp_is_link_command(v_media->>'caption') THEN
  INSERT INTO public.whatsapp_announcement_decisions(wa_message_id,decision) VALUES(v_id,'link_command');
  RETURN;
END IF;
v_phone:='+'||(p_message->>'from');
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
END; $function$;

-- Inbound routing: link command is handled (redacted/consumed) BEFORE the publisher exclusion.
CREATE OR REPLACE FUNCTION public.support_route_wa_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _digits text := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'); _code text; _c public.whatsapp_link_codes%ROWTYPE;
  _link public.whatsapp_member_links%ROWTYPE; _member integer; _thread uuid; _inserted uuid; _body text;
BEGIN
  IF NEW.direction <> 'inbound' OR _digits = '' THEN RETURN NEW; END IF;
  IF public.whatsapp_is_link_command(NEW.body) THEN
    _code := upper(btrim(NEW.body));
    NEW.body := '(koppelcode ontvangen)';
    UPDATE public.whatsapp_webhook_events
      SET payload = regexp_replace(payload::text, _code, 'BCD-VERWIJDERD', 'gi')::jsonb,
          parsed_messages = regexp_replace(parsed_messages::text, _code, 'BCD-VERWIJDERD', 'gi')::jsonb
      WHERE received_at > now() - interval '1 day' AND payload::text ILIKE '%' || _code || '%';
    IF _code !~ '^BCD-[A-HJ-NP-Z2-9]{8}$' THEN
      INSERT INTO public.whatsapp_link_attempts(phone, success) VALUES (_digits, false); RETURN NEW; END IF;
    IF (SELECT count(*) FROM public.whatsapp_link_attempts WHERE phone = _digits AND NOT success AND at > now() - interval '1 hour') >= 5 THEN
      RETURN NEW; END IF;
    SELECT * INTO _c FROM public.whatsapp_link_codes
      WHERE code_hash = encode(extensions.digest(_code, 'sha256'), 'hex') AND used_at IS NULL AND expires_at > now() FOR UPDATE;
    _member := CASE WHEN FOUND THEN public.support_member_id(_c.user_id) END;
    IF _member IS NULL THEN
      INSERT INTO public.whatsapp_link_attempts(phone, success) VALUES (_digits, false); RETURN NEW; END IF;
    UPDATE public.whatsapp_link_codes SET used_at = now() WHERE id = _c.id;
    UPDATE public.whatsapp_member_links SET revoked_at = now(), revoked_reason = 'vervangen'
      WHERE revoked_at IS NULL AND (phone = _digits OR user_id = _c.user_id);
    INSERT INTO public.whatsapp_member_links(user_id, member_id, phone, verified_at) VALUES (_c.user_id, _member, _digits, now());
    INSERT INTO public.whatsapp_link_attempts(phone, success) VALUES (_digits, true);
    RETURN NEW;
  END IF;
  -- Announcement publishers keep their own route; never stored twice as a question.
  IF EXISTS (SELECT 1 FROM public.whatsapp_announcement_publishers p WHERE p.enabled AND regexp_replace(p.phone, '\D', '', 'g') = _digits) THEN RETURN NEW; END IF;
  SELECT * INTO _link FROM public.whatsapp_member_links WHERE phone = _digits AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN NEW; END IF;
  _member := public.support_member_id(_link.user_id);
  IF _member IS NULL THEN
    UPDATE public.whatsapp_member_links SET revoked_at = now(), revoked_reason = 'lid_niet_actief' WHERE id = _link.id; RETURN NEW; END IF;
  IF COALESCE(NEW.timestamp, now()) < _link.verified_at THEN RETURN NEW; END IF;
  IF NEW.wa_message_id IS NULL OR EXISTS (SELECT 1 FROM public.support_messages WHERE wa_message_id = NEW.wa_message_id) THEN RETURN NEW; END IF;
  _body := CASE WHEN NEW.message_type = 'text' AND NULLIF(btrim(COALESCE(NEW.body, '')), '') IS NOT NULL THEN left(NEW.body, 5000)
    ELSE '(WhatsApp-' || NEW.message_type || COALESCE(': ' || NULLIF(left(NEW.body, 4000), ''), '') || ' — bestand alleen in de beheerinbox, niet hier beschikbaar)' END;
  SELECT id INTO _thread FROM public.support_threads WHERE wa_link_id = _link.id AND status <> 'afgerond' ORDER BY last_activity_at DESC LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.support_threads(user_id, member_id, subject, channel, wa_link_id) VALUES (_link.user_id, _member, 'Vraag via WhatsApp', 'whatsapp', _link.id) RETURNING id INTO _thread;
  END IF;
  INSERT INTO public.support_messages(thread_id, author_kind, author_user_id, channel, body, wa_message_id, sent_at)
    VALUES (_thread, 'member', _link.user_id, 'whatsapp', _body, NEW.wa_message_id, COALESCE(NEW.timestamp, now()))
    ON CONFLICT (wa_message_id) DO NOTHING RETURNING id INTO _inserted;
  IF _inserted IS NOT NULL THEN
    UPDATE public.support_threads SET admin_unread = true, last_activity_at = now(),
      status = CASE WHEN status = 'wacht_op_lid' THEN 'nieuw' ELSE status END WHERE id = _thread;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.support_redact_wa_preview()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.whatsapp_is_link_command(NEW.last_message_preview) THEN NEW.last_message_preview := '(koppelcode ontvangen)'; END IF;
  RETURN NEW;
END $$;

-- Reserve: dedup re-checked under the thread lock and via ON CONFLICT; never a second send.
CREATE OR REPLACE FUNCTION public.support_wa_reserve_reply(p_thread uuid, p_body text, p_client_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _t public.support_threads%ROWTYPE; _link public.whatsapp_member_links%ROWTYPE;
  _existing public.support_messages%ROWTYPE; _last timestamptz; _id uuid; _body text := btrim(p_body);
BEGIN
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_client_key IS NULL OR char_length(_body) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'invalid input' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _t FROM public.support_threads WHERE id = p_thread FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_whatsapp_link' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO _existing FROM public.support_messages WHERE client_key = p_client_key;
  IF FOUND THEN
    IF _existing.thread_id <> p_thread THEN RAISE EXCEPTION 'invalid input' USING ERRCODE = '22023'; END IF;
    RETURN jsonb_build_object('message_id', _existing.id, 'existing', true, 'state', _existing.wa_status);
  END IF;
  IF _t.wa_link_id IS NULL THEN RAISE EXCEPTION 'no_whatsapp_link' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO _link FROM public.whatsapp_member_links WHERE id = _t.wa_link_id AND revoked_at IS NULL;
  IF NOT FOUND OR public.support_member_id(_link.user_id) IS NULL THEN RAISE EXCEPTION 'no_whatsapp_link' USING ERRCODE = 'P0001'; END IF;
  SELECT max(m.sent_at) INTO _last FROM public.support_messages m JOIN public.support_threads t ON t.id = m.thread_id
    WHERE t.wa_link_id = _link.id AND m.author_kind = 'member' AND m.channel = 'whatsapp' AND m.wa_message_id IS NOT NULL;
  IF _last IS NULL OR _last < now() - interval '24 hours' THEN RAISE EXCEPTION 'outside_window' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.support_messages(thread_id, author_kind, author_user_id, channel, body, client_key, wa_status)
    VALUES (p_thread, 'admin', _uid, 'whatsapp', _body, p_client_key, 'pending')
    ON CONFLICT (client_key) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT * INTO _existing FROM public.support_messages WHERE client_key = p_client_key AND thread_id = p_thread;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid input' USING ERRCODE = '22023'; END IF;
    RETURN jsonb_build_object('message_id', _existing.id, 'existing', true, 'state', _existing.wa_status);
  END IF;
  UPDATE public.support_threads SET member_unread = true, admin_unread = false, last_activity_at = now(),
    status = CASE WHEN status = 'nieuw' THEN 'in_behandeling' ELSE status END WHERE id = p_thread;
  RETURN jsonb_build_object('message_id', _id, 'existing', false, 'state', 'pending', 'phone', _link.phone, 'body', _body);
END $$;