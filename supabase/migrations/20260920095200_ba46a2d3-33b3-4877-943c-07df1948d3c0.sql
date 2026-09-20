ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_type_len;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_type_len
  CHECK (char_length(message_type) BETWEEN 1 AND 40);

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_body_len;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_body_len
  CHECK (body IS NULL OR char_length(body) <= 4000);

CREATE INDEX IF NOT EXISTS whatsapp_messages_unread_idx
  ON public.whatsapp_messages (phone) WHERE read_by_us_at IS NULL;

REVOKE ALL ON public.whatsapp_conversations FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_messages FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_conversations TO authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and board can manage conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Admins and board can view conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Admins and board can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admins and board can update messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admins and board can view all messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admins can delete messages" ON public.whatsapp_messages;

DROP POLICY IF EXISTS "Board reads whatsapp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Board reads whatsapp conversations"
ON public.whatsapp_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_board_member(auth.uid()));

DROP POLICY IF EXISTS "Board reads whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Board reads whatsapp messages"
ON public.whatsapp_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_board_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_read_whatsapp_inbox(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.is_board_member(_user_id);
$$;

REVOKE ALL ON FUNCTION public.can_read_whatsapp_inbox(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_whatsapp_inbox(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_mark_conversation_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_count integer;
BEGIN
  IF NOT public.can_read_whatsapp_inbox(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT phone INTO v_phone
    FROM public.whatsapp_conversations
   WHERE id = p_conversation_id;

  IF v_phone IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.whatsapp_messages
     SET read_by_us_at = now()
   WHERE phone = v_phone
     AND read_by_us_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.whatsapp_conversations
     SET unread_count = 0
   WHERE id = p_conversation_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_mark_conversation_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_ingest_message(
  p_phone text,
  p_profile_name text,
  p_wa_message_id text,
  p_message_type text,
  p_body text,
  p_media_type text,
  p_sent_at timestamptz,
  p_preview text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.whatsapp_ingest_message(
  text, text, text, text, text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ingest_message(
  text, text, text, text, text, text, timestamptz, text
) TO service_role;

ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'whatsapp_messages'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
END
$$;