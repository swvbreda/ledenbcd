CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

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
      FOR m IN SELECT value FROM jsonb_array_elements(e.parsed_messages) LOOP
        PERFORM public.whatsapp_ingest_message(
          m->>'waId',m->>'profileName',m->>'waMessageId',m->>'messageType',
          m->>'body',m->>'mediaMimeType',(m->>'sentAt')::timestamptz,
          left(COALESCE(m->>'body','(' || (m->>'messageType') || ')'),140)
        );
        UPDATE public.whatsapp_messages SET media_id=COALESCE(media_id,m->>'mediaId')
          WHERE wa_message_id=m->>'waMessageId' AND direction='inbound';
      END LOOP;
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
    -- Subtransaction rolls back business writes, not durable receipt.
    UPDATE public.whatsapp_webhook_events SET processing_error=SQLSTATE,
      next_attempt_at=now()+interval '1 minute', attempts=attempts+1
      WHERE delivery_id=p_delivery_id;
    RETURN false;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_connector_receive(p_delivery_id text, p_event text, p_payload jsonb, p_messages jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.whatsapp_webhook_events(delivery_id,event,payload,parsed_messages)
  VALUES(p_delivery_id,p_event,p_payload,p_messages)
  ON CONFLICT (delivery_id) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_connector_recover()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id text;
BEGIN
  FOR v_id IN SELECT delivery_id FROM public.whatsapp_webhook_events
    WHERE processed_at IS NULL AND next_attempt_at<=now()
    ORDER BY next_attempt_at,received_at LIMIT 5 FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.whatsapp_connector_process(v_id);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_ingest_message(p_phone text, p_profile_name text, p_wa_message_id text, p_message_type text, p_body text, p_media_type text, p_sent_at timestamp with time zone, p_preview text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conversation_id uuid;
  v_received_at timestamptz := COALESCE(p_sent_at, now());
  v_rows integer;
BEGIN
  INSERT INTO public.whatsapp_conversations (phone, display_name)
  VALUES (p_phone, NULLIF(left(COALESCE(p_profile_name, ''), 200), ''))
  ON CONFLICT (phone) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, public.whatsapp_conversations.display_name)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.whatsapp_messages (
    phone, direction, message_type, body, media_type, status, wa_message_id, timestamp
  )
  VALUES (
    p_phone, 'inbound',
    left(COALESCE(NULLIF(p_message_type, ''), 'unknown'), 40),
    left(p_body, 4000), p_media_type, 'received', p_wa_message_id, v_received_at
  )
  ON CONFLICT (wa_message_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    UPDATE public.whatsapp_conversations
       SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, v_received_at), v_received_at),
           unread_count = unread_count + 1
     WHERE id = v_conversation_id;

    UPDATE public.whatsapp_conversations
       SET last_message_at = v_received_at,
           last_message_preview = left(COALESCE(p_preview, ''), 200)
     WHERE id = v_conversation_id
       AND (last_message_at IS NULL OR last_message_at <= v_received_at);
  END IF;

  RETURN v_rows > 0;
END;
$function$;

