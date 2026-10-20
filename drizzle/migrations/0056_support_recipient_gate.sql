CREATE OR REPLACE FUNCTION public.support_route_wa_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _digits text := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'); _code text; _c public.whatsapp_link_codes%ROWTYPE;
  _link public.whatsapp_member_links%ROWTYPE; _member integer; _thread uuid; _inserted uuid; _body text;
  _ok boolean := COALESCE(current_setting('bcd.wa_recipient', true), '') = '1312061225331302';
BEGIN
  IF NEW.direction <> 'inbound' OR _digits = '' THEN RETURN NEW; END IF;
  IF public.whatsapp_is_link_command(NEW.body) THEN
    _code := upper(btrim(NEW.body));
    NEW.body := '(koppelcode ontvangen)';
    UPDATE public.whatsapp_webhook_events
      SET payload = regexp_replace(payload::text, _code, 'BCD-VERWIJDERD', 'gi')::jsonb,
          parsed_messages = regexp_replace(parsed_messages::text, _code, 'BCD-VERWIJDERD', 'gi')::jsonb
      WHERE received_at > now() - interval '1 day' AND payload::text ILIKE '%' || _code || '%';
    -- Only messages verified as sent to the fixed BCD number may consume codes or count attempts.
    IF NOT _ok THEN RETURN NEW; END IF;
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
  IF NOT _ok THEN RETURN NEW; END IF;
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

-- Support routing runs only inside a verified ingest whose recipient is the fixed BCD number.
CREATE OR REPLACE FUNCTION public.whatsapp_ingest_verified(p_message jsonb, p_recipient text, p_parsed jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
IF p_message->>'id' IS DISTINCT FROM p_parsed->>'waMessageId' OR p_message->>'from' IS DISTINCT FROM p_parsed->>'waId' THEN RAISE EXCEPTION 'Message mismatch'; END IF;
PERFORM set_config('bcd.wa_recipient', COALESCE(p_recipient, ''), true);
PERFORM public.whatsapp_ingest_message(p_parsed->>'waId',p_parsed->>'profileName',p_parsed->>'waMessageId',p_parsed->>'messageType',p_parsed->>'body',p_parsed->>'mediaMimeType',(p_parsed->>'sentAt')::timestamptz,left(p_parsed->>'body',140));
PERFORM set_config('bcd.wa_recipient', '', true);
PERFORM public.whatsapp_publish_forwarded(p_message,p_recipient); END; $function$;

CREATE OR REPLACE FUNCTION public.whatsapp_connector_process(p_delivery_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e public.whatsapp_webhook_events%ROWTYPE;
  m jsonb;
  s jsonb;
  v_state text;
  v_previous text;
  v_time timestamptz;
  v_pending boolean := false;
BEGIN
  SELECT * INTO e FROM public.whatsapp_webhook_events WHERE delivery_id=p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF e.processed_at IS NOT NULL THEN RETURN true; END IF;
  BEGIN
    IF e.event='whatsapp.message' THEN
      PERFORM set_config('bcd.wa_recipient', COALESCE((SELECT CASE WHEN count(DISTINCT x #>> '{}') = 1 THEN min(x #>> '{}') END FROM jsonb_path_query(e.payload, '$.entry[*].changes[*].value.metadata.phone_number_id') x), ''), true);
      FOR m IN SELECT value FROM jsonb_array_elements(e.parsed_messages) LOOP
        PERFORM public.whatsapp_ingest_message(
          m->>'waId',m->>'profileName',m->>'waMessageId',m->>'messageType',
          m->>'body',m->>'mediaMimeType',(m->>'sentAt')::timestamptz,
          left(COALESCE(m->>'body','(' || (m->>'messageType') || ')'),140)
        );
        UPDATE public.whatsapp_messages SET media_id=COALESCE(media_id,m->>'mediaId')
          WHERE wa_message_id=m->>'waMessageId' AND direction='inbound';
      END LOOP;
      PERFORM set_config('bcd.wa_recipient', '', true);
    ELSIF e.event='whatsapp.status' THEN
      FOR s IN SELECT value FROM jsonb_array_elements(e.payload #> '{entry,0,changes,0,value,statuses}') LOOP
        SELECT status INTO v_previous FROM public.whatsapp_messages
          WHERE wa_message_id=s->>'id' AND direction='outbound' FOR UPDATE;
        IF NOT FOUND THEN v_pending:=true; CONTINUE; END IF;
        v_state:=s->>'status';
        v_time:=to_timestamp((s->>'timestamp')::double precision);
        UPDATE public.whatsapp_messages SET
          status=CASE
            WHEN v_previous='read' THEN v_previous
            WHEN v_state='read' THEN v_state
            WHEN v_previous='delivered' THEN v_previous
            WHEN v_state='delivered' THEN v_state
            WHEN v_previous='failed' AND v_state='sent' THEN v_previous
            ELSE v_state END,
          provider_status_times=CASE WHEN provider_status_times ? v_state THEN provider_status_times
            ELSE provider_status_times || jsonb_build_object(v_state,v_time) END,
          error=CASE WHEN s ? 'errors' THEN (s->'errors')::text ELSE error END
          WHERE wa_message_id=s->>'id' AND direction='outbound';
      END LOOP;
    END IF;
    -- Unknown events (including history/contacts/echoes) are retained only, never imported.
    UPDATE public.whatsapp_webhook_events SET
      processed_at=CASE WHEN v_pending THEN NULL ELSE now() END,
      processing_error=CASE WHEN v_pending THEN 'Awaiting outbound message' ELSE NULL END,
      next_attempt_at=now()+interval '5 minutes', attempts=attempts+1
      WHERE delivery_id=p_delivery_id;
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('bcd.wa_recipient', '', true);
    -- Subtransaction rolls back business writes, not durable receipt.
    UPDATE public.whatsapp_webhook_events SET processing_error=SQLSTATE,
      next_attempt_at=now()+interval '1 minute', attempts=attempts+1
      WHERE delivery_id=p_delivery_id;
    RETURN false;
  END;
END;
$function$;