-- Mijn vragen: per-user support threads with app + verified WhatsApp channel.
CREATE OR REPLACE FUNCTION public.support_member_id(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT min(mp.member_id) FROM public.member_profiles mp
  JOIN public.members_data md ON md.id = mp.member_id AND md.member_type = 'member'
  WHERE _uid IS NOT NULL AND mp.user_id = _uid
    AND NOT public.has_role(_uid, 'extern') AND NOT public.has_role(_uid, 'inhuur')
$$;
REVOKE ALL ON FUNCTION public.support_member_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_member_id(uuid) TO authenticated, service_role;

CREATE TABLE public.whatsapp_member_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  member_id integer NOT NULL,
  phone text NOT NULL CHECK (phone ~ '^\d{5,20}$'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text
);
CREATE UNIQUE INDEX whatsapp_member_links_active_phone ON public.whatsapp_member_links(phone) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX whatsapp_member_links_active_user ON public.whatsapp_member_links(user_id) WHERE revoked_at IS NULL;
GRANT SELECT ON public.whatsapp_member_links TO authenticated;
GRANT ALL ON public.whatsapp_member_links TO service_role;
ALTER TABLE public.whatsapp_member_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin reads links" ON public.whatsapp_member_links FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Service-only: no policies, no grants to client roles.
CREATE TABLE public.whatsapp_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
GRANT ALL ON public.whatsapp_link_codes TO service_role;
ALTER TABLE public.whatsapp_link_codes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.whatsapp_link_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone text NOT NULL,
  success boolean NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_link_attempts_phone ON public.whatsapp_link_attempts(phone, at);
GRANT ALL ON public.whatsapp_link_attempts TO service_role;
ALTER TABLE public.whatsapp_link_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  member_id integer NOT NULL,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 150),
  status text NOT NULL DEFAULT 'nieuw' CHECK (status IN ('nieuw','in_behandeling','wacht_op_lid','afgerond')),
  channel text NOT NULL DEFAULT 'app' CHECK (channel IN ('app','whatsapp')),
  wa_link_id uuid REFERENCES public.whatsapp_member_links(id),
  project_id uuid,
  admin_unread boolean NOT NULL DEFAULT true,
  member_unread boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_threads_user ON public.support_threads(user_id, last_activity_at DESC);
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  author_kind text NOT NULL CHECK (author_kind IN ('member','admin')),
  author_user_id uuid,
  channel text NOT NULL CHECK (channel IN ('app','whatsapp')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  client_key uuid UNIQUE,
  wa_message_id text UNIQUE,
  wa_status text CHECK (wa_status IN ('pending','queued','sent','delivered','read','failed','unknown')),
  wa_error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_thread ON public.support_messages(thread_id, sent_at);
CREATE TABLE public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  mime text NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png')),
  size integer NOT NULL CHECK (size > 0 AND size <= 10485760),
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.support_can_read_thread(_thread uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.support_threads t
    WHERE t.id = _thread AND t.user_id = auth.uid()
      AND public.support_member_id(auth.uid()) IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.support_can_read_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_can_read_thread(uuid) TO authenticated;

-- Reads only; every write goes through checked RPCs below.
GRANT SELECT ON public.support_threads, public.support_messages, public.support_attachments TO authenticated;
GRANT ALL ON public.support_threads, public.support_messages, public.support_attachments TO service_role;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner active member or admin" ON public.support_threads FOR SELECT TO authenticated
  USING ((user_id = auth.uid() AND public.support_member_id(auth.uid()) IS NOT NULL) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Readable thread" ON public.support_messages FOR SELECT TO authenticated
  USING (public.support_can_read_thread(thread_id));
CREATE POLICY "Readable thread" ON public.support_attachments FOR SELECT TO authenticated
  USING (public.support_can_read_thread(thread_id));

CREATE OR REPLACE FUNCTION public.support_create_thread(p_subject text, p_body text, p_project_id uuid, p_client_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _member integer; _thread uuid; _subject text := btrim(p_subject); _body text := btrim(p_body);
BEGIN
  _member := public.support_member_id(_uid);
  IF _member IS NULL THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_client_key IS NULL THEN RAISE EXCEPTION 'client_key required' USING ERRCODE = '22023'; END IF;
  SELECT m.thread_id INTO _thread FROM public.support_messages m JOIN public.support_threads t ON t.id = m.thread_id
    WHERE m.client_key = p_client_key AND t.user_id = _uid;
  IF FOUND THEN RETURN _thread; END IF;
  IF char_length(_subject) NOT BETWEEN 3 AND 150 OR char_length(_body) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'invalid input' USING ERRCODE = '22023'; END IF;
  -- Same project set as get_member_project_status(); never opens internal_projects.
  IF p_project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internal_projects p WHERE p.id = p_project_id AND p.archived_at IS NULL) THEN
    RAISE EXCEPTION 'invalid project' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.support_threads(user_id, member_id, subject, project_id) VALUES (_uid, _member, _subject, p_project_id) RETURNING id INTO _thread;
  INSERT INTO public.support_messages(thread_id, author_kind, author_user_id, channel, body, client_key)
    VALUES (_thread, 'member', _uid, 'app', _body, p_client_key);
  RETURN _thread;
END $$;

CREATE OR REPLACE FUNCTION public.support_member_reply(p_thread uuid, p_body text, p_client_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _body text := btrim(p_body);
BEGIN
  IF public.support_member_id(_uid) IS NULL OR NOT EXISTS (SELECT 1 FROM public.support_threads WHERE id = p_thread AND user_id = _uid) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  SELECT id INTO _id FROM public.support_messages WHERE client_key = p_client_key AND thread_id = p_thread;
  IF FOUND THEN RETURN _id; END IF;
  IF p_client_key IS NULL OR char_length(_body) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'invalid input' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.support_messages(thread_id, author_kind, author_user_id, channel, body, client_key)
    VALUES (p_thread, 'member', _uid, 'app', _body, p_client_key) RETURNING id INTO _id;
  UPDATE public.support_threads SET admin_unread = true, last_activity_at = now(),
    status = CASE WHEN status IN ('wacht_op_lid','afgerond') THEN 'nieuw' ELSE status END WHERE id = p_thread;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.support_admin_reply(p_thread uuid, p_body text, p_client_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _body text := btrim(p_body);
BEGIN
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  SELECT id INTO _id FROM public.support_messages WHERE client_key = p_client_key AND thread_id = p_thread;
  IF FOUND THEN RETURN _id; END IF;
  IF p_client_key IS NULL OR char_length(_body) NOT BETWEEN 1 AND 5000 OR NOT EXISTS (SELECT 1 FROM public.support_threads WHERE id = p_thread) THEN
    RAISE EXCEPTION 'invalid input' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.support_messages(thread_id, author_kind, author_user_id, channel, body, client_key)
    VALUES (p_thread, 'admin', _uid, 'app', _body, p_client_key) RETURNING id INTO _id;
  UPDATE public.support_threads SET member_unread = true, admin_unread = false, last_activity_at = now(),
    status = CASE WHEN status = 'nieuw' THEN 'in_behandeling' ELSE status END WHERE id = p_thread;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.support_admin_set_status(p_thread uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('nieuw','in_behandeling','wacht_op_lid','afgerond') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023'; END IF;
  UPDATE public.support_threads SET status = p_status WHERE id = p_thread;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found' USING ERRCODE = '22023'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.support_mark_read(p_thread uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN UPDATE public.support_threads SET admin_unread = false WHERE id = p_thread; END IF;
  IF public.support_member_id(auth.uid()) IS NOT NULL THEN
    UPDATE public.support_threads SET member_unread = false WHERE id = p_thread AND user_id = auth.uid(); END IF;
END $$;

-- Attachments: object must already exist under "<thread>/<caller>/", owned by caller, allowed type, <=10MB.
CREATE OR REPLACE FUNCTION public.support_add_attachment(p_thread uuid, p_message uuid, p_path text, p_file_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE _uid uuid := auth.uid(); _admin boolean := public.has_role(auth.uid(), 'admin'); _size bigint; _mime text; _id uuid;
BEGIN
  IF NOT (_admin OR (public.support_member_id(_uid) IS NOT NULL AND EXISTS (SELECT 1 FROM public.support_threads WHERE id = p_thread AND user_id = _uid))) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_messages WHERE id = p_message AND thread_id = p_thread AND author_user_id = _uid AND channel = 'app') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_path !~ ('^' || p_thread::text || '/' || _uid::text || '/[0-9a-f-]{36}\.(pdf|jpg|png)$') THEN RAISE EXCEPTION 'invalid path' USING ERRCODE = '22023'; END IF;
  SELECT (o.metadata->>'size')::bigint, o.metadata->>'mimetype' INTO _size, _mime FROM storage.objects o
    WHERE o.bucket_id = 'support-attachments' AND o.name = p_path AND o.owner_id = _uid::text;
  IF NOT FOUND OR _size IS NULL OR _size > 10485760 OR _mime NOT IN ('application/pdf','image/jpeg','image/png') THEN
    RAISE EXCEPTION 'invalid file' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.support_attachments(thread_id, message_id, path, file_name, mime, size, uploaded_by)
    VALUES (p_thread, p_message, p_path, left(btrim(p_file_name), 200), _mime, _size, _uid) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE POLICY "Support upload own thread folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('pdf','jpg','png')
    AND EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id::text = (storage.foldername(name))[1]
      AND (public.has_role(auth.uid(), 'admin') OR (t.user_id = auth.uid() AND public.support_member_id(auth.uid()) IS NOT NULL))));
CREATE POLICY "Support download registered attachment" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments' AND EXISTS (
    SELECT 1 FROM public.support_attachments a WHERE a.path = name AND public.support_can_read_thread(a.thread_id)));

-- WhatsApp link codes (hashed, 10 min, max 3 per hour per user).
CREATE OR REPLACE FUNCTION public.support_wa_create_code()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; _code text := 'BCD-'; _bytes bytea; i int;
BEGIN
  IF public.support_member_id(_uid) IS NULL THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM public.whatsapp_link_codes WHERE user_id = _uid AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.whatsapp_link_codes SET expires_at = now() WHERE user_id = _uid AND used_at IS NULL AND expires_at > now();
  _bytes := extensions.gen_random_bytes(8);
  FOR i IN 0..7 LOOP _code := _code || substr(_alphabet, (get_byte(_bytes, i) % 32) + 1, 1); END LOOP;
  INSERT INTO public.whatsapp_link_codes(user_id, code_hash, expires_at)
    VALUES (_uid, encode(extensions.digest(_code, 'sha256'), 'hex'), now() + interval '10 minutes');
  RETURN _code;
END $$;

CREATE OR REPLACE FUNCTION public.support_wa_unlink()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.whatsapp_member_links SET revoked_at = now(), revoked_reason = 'ontkoppeld_door_lid'
  WHERE user_id = auth.uid() AND revoked_at IS NULL
$$;
CREATE OR REPLACE FUNCTION public.support_admin_wa_revoke(p_link uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  UPDATE public.whatsapp_member_links SET revoked_at = now(), revoked_reason = 'ingetrokken_door_beheer' WHERE id = p_link AND revoked_at IS NULL;
END $$;

-- Inbound routing (both verified webhook paths insert into whatsapp_messages).
CREATE OR REPLACE FUNCTION public.support_route_wa_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _digits text := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'); _code text; _c public.whatsapp_link_codes%ROWTYPE;
  _link public.whatsapp_member_links%ROWTYPE; _member integer; _thread uuid; _inserted uuid; _body text;
BEGIN
  IF NEW.direction <> 'inbound' OR _digits = '' THEN RETURN NEW; END IF;
  -- Announcement publishers keep their own route; never stored twice as a question.
  IF EXISTS (SELECT 1 FROM public.whatsapp_announcement_publishers p WHERE p.enabled AND regexp_replace(p.phone, '\D', '', 'g') = _digits) THEN RETURN NEW; END IF;
  _code := upper(btrim(COALESCE(NEW.body, '')));
  IF _code ~ '^BCD-[A-HJ-NP-Z2-9]{8}$' THEN
    NEW.body := '(koppelcode ontvangen)';
    UPDATE public.whatsapp_webhook_events
      SET payload = regexp_replace(payload::text, _code, 'BCD-VERWIJDERD', 'gi')::jsonb,
          parsed_messages = regexp_replace(parsed_messages::text, _code, 'BCD-VERWIJDERD', 'gi')::jsonb
      WHERE received_at > now() - interval '1 day' AND payload::text ILIKE '%' || _code || '%';
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
  SELECT * INTO _link FROM public.whatsapp_member_links WHERE phone = _digits AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN NEW; END IF;
  _member := public.support_member_id(_link.user_id);
  IF _member IS NULL THEN
    UPDATE public.whatsapp_member_links SET revoked_at = now(), revoked_reason = 'lid_niet_actief' WHERE id = _link.id; RETURN NEW; END IF;
  IF COALESCE(NEW.timestamp, now()) < _link.verified_at THEN RETURN NEW; END IF; -- never retroactive
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
CREATE TRIGGER support_route_wa_inbound BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_route_wa_inbound();

CREATE OR REPLACE FUNCTION public.support_redact_wa_preview()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF upper(btrim(COALESCE(NEW.last_message_preview, ''))) ~ '^BCD-[A-HJ-NP-Z2-9]{8}$' THEN NEW.last_message_preview := '(koppelcode ontvangen)'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER support_redact_wa_preview BEFORE INSERT OR UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.support_redact_wa_preview();

-- WhatsApp replies: reserve (admin, 24h after last real inbound member message), then finish once.
CREATE OR REPLACE FUNCTION public.support_wa_reserve_reply(p_thread uuid, p_body text, p_client_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _t public.support_threads%ROWTYPE; _link public.whatsapp_member_links%ROWTYPE;
  _existing public.support_messages%ROWTYPE; _last timestamptz; _id uuid; _body text := btrim(p_body);
BEGIN
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _existing FROM public.support_messages WHERE client_key = p_client_key AND thread_id = p_thread;
  IF FOUND THEN RETURN jsonb_build_object('message_id', _existing.id, 'existing', true, 'state', _existing.wa_status); END IF;
  IF p_client_key IS NULL OR char_length(_body) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'invalid input' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _t FROM public.support_threads WHERE id = p_thread FOR UPDATE;
  IF NOT FOUND OR _t.wa_link_id IS NULL THEN RAISE EXCEPTION 'no_whatsapp_link' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO _link FROM public.whatsapp_member_links WHERE id = _t.wa_link_id AND revoked_at IS NULL;
  IF NOT FOUND OR public.support_member_id(_link.user_id) IS NULL THEN RAISE EXCEPTION 'no_whatsapp_link' USING ERRCODE = 'P0001'; END IF;
  SELECT max(m.sent_at) INTO _last FROM public.support_messages m JOIN public.support_threads t ON t.id = m.thread_id
    WHERE t.wa_link_id = _link.id AND m.author_kind = 'member' AND m.channel = 'whatsapp' AND m.wa_message_id IS NOT NULL;
  IF _last IS NULL OR _last < now() - interval '24 hours' THEN RAISE EXCEPTION 'outside_window' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.support_messages(thread_id, author_kind, author_user_id, channel, body, client_key, wa_status)
    VALUES (p_thread, 'admin', _uid, 'whatsapp', _body, p_client_key, 'pending') RETURNING id INTO _id;
  UPDATE public.support_threads SET member_unread = true, admin_unread = false, last_activity_at = now(),
    status = CASE WHEN status = 'nieuw' THEN 'in_behandeling' ELSE status END WHERE id = p_thread;
  RETURN jsonb_build_object('message_id', _id, 'existing', false, 'state', 'pending', 'phone', _link.phone, 'body', _body);
END $$;

CREATE OR REPLACE FUNCTION public.support_wa_finish_reply(p_message uuid, p_outcome text, p_wa_id text, p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.support_messages%ROWTYPE; _phone text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_outcome NOT IN ('accepted','failed','unknown') OR (p_outcome = 'accepted' AND COALESCE(p_wa_id, '') = '') THEN
    RAISE EXCEPTION 'invalid outcome' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _m FROM public.support_messages WHERE id = p_message AND wa_status = 'pending' AND author_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not pending' USING ERRCODE = 'P0001'; END IF;
  IF p_outcome = 'accepted' THEN
    SELECT l.phone INTO _phone FROM public.support_threads t JOIN public.whatsapp_member_links l ON l.id = t.wa_link_id WHERE t.id = _m.thread_id;
    UPDATE public.support_messages SET wa_status = 'queued', wa_message_id = left(p_wa_id, 512) WHERE id = p_message;
    INSERT INTO public.whatsapp_messages(phone, direction, message_type, body, status, wa_message_id, sent_by)
      VALUES (_phone, 'outbound', 'text', _m.body, 'queued', left(p_wa_id, 512), auth.uid()) ON CONFLICT (wa_message_id) DO NOTHING;
    UPDATE public.whatsapp_conversations SET last_message_at = now(), last_message_preview = left(_m.body, 200) WHERE phone = _phone;
  ELSE
    UPDATE public.support_messages SET wa_status = p_outcome, wa_error = left(p_error, 300) WHERE id = p_message;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.support_sync_wa_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction = 'outbound' AND NEW.wa_message_id IS NOT NULL AND NEW.status IN ('sent','delivered','read','failed') THEN
    UPDATE public.support_messages SET wa_status = NEW.status, wa_error = CASE WHEN NEW.status = 'failed' THEN left(NEW.error, 300) ELSE wa_error END
      WHERE wa_message_id = NEW.wa_message_id AND author_kind = 'admin';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER support_sync_wa_status AFTER UPDATE OF status ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_sync_wa_status();

-- Admin listing with verified member identity.
CREATE OR REPLACE FUNCTION public.support_admin_threads()
RETURNS TABLE(id uuid, subject text, status text, channel text, admin_unread boolean, last_activity_at timestamptz,
  member_id integer, member_name text, project_id uuid, link_active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT t.id, t.subject, t.status, t.channel, t.admin_unread, t.last_activity_at, t.member_id,
    COALESCE(NULLIF(md.data->>'naam', ''), md.data->>'bedrijfsnaam'), t.project_id,
    (t.wa_link_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.whatsapp_member_links l WHERE l.id = t.wa_link_id AND l.revoked_at IS NULL))
  FROM public.support_threads t LEFT JOIN public.members_data md ON md.id = t.member_id
  ORDER BY t.admin_unread DESC, t.last_activity_at DESC LIMIT 500;
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['support_create_thread(text,text,uuid,uuid)','support_member_reply(uuid,text,uuid)','support_admin_reply(uuid,text,uuid)',
    'support_admin_set_status(uuid,text)','support_mark_read(uuid)','support_add_attachment(uuid,uuid,text,text)','support_wa_create_code()',
    'support_wa_unlink()','support_admin_wa_revoke(uuid)','support_wa_reserve_reply(uuid,text,uuid)','support_wa_finish_reply(uuid,text,text,text)',
    'support_admin_threads()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.support_route_wa_inbound() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.support_sync_wa_status() FROM PUBLIC, anon, authenticated;
END $$;