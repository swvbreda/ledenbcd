CREATE TABLE public.whatsapp_webhook_events (
  delivery_id text PRIMARY KEY CHECK (length(delivery_id) BETWEEN 1 AND 512),
  event text NOT NULL CHECK (length(event) BETWEEN 1 AND 120),
  payload jsonb NOT NULL,
  parsed_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read connector receipts" ON public.whatsapp_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX whatsapp_webhook_pending ON public.whatsapp_webhook_events (next_attempt_at, received_at) WHERE processed_at IS NULL;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_id text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS provider_status_times jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE FUNCTION public.whatsapp_connector_receive(p_delivery_id text, p_event text, p_payload jsonb, p_messages jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.whatsapp_webhook_events(delivery_id,event,payload,parsed_messages)
  VALUES(p_delivery_id,p_event,p_payload,p_messages)
  ON CONFLICT (delivery_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_connector_receive(text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_connector_receive(text,text,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.whatsapp_connector_process(p_delivery_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;
REVOKE ALL ON FUNCTION public.whatsapp_connector_process(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_connector_process(text) TO service_role;

CREATE FUNCTION public.whatsapp_connector_recover()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id text;
BEGIN
  FOR v_id IN SELECT delivery_id FROM public.whatsapp_webhook_events
    WHERE processed_at IS NULL AND next_attempt_at<=now()
    ORDER BY next_attempt_at,received_at LIMIT 5 FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.whatsapp_connector_process(v_id);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_connector_recover() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_connector_recover() TO service_role;
COMMENT ON TABLE public.whatsapp_webhook_events IS 'Verified connector deliveries; admin-only reads, no sending/imports. Fair bounded recovery on later callbacks; quiet periods delay retries.';