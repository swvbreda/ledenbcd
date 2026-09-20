-- Referentiekopie van de WhatsApp-inbox migratie.
-- De map supabase/migrations/ is beheerd: dit bestand wordt daar automatisch
-- vastgelegd zodra de database bereikbaar is en de migratie is toegepast.
-- Idempotent: herhaald uitvoeren is veilig.

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL UNIQUE,
  profile_name text,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conversations_wa_id_len CHECK (char_length(wa_id) BETWEEN 5 AND 32),
  CONSTRAINT whatsapp_conversations_profile_len CHECK (profile_name IS NULL OR char_length(profile_name) <= 200),
  CONSTRAINT whatsapp_conversations_preview_len CHECK (last_message_preview IS NULL OR char_length(last_message_preview) <= 200)
);

-- Berichten bevatten bewust geen telefoonnummer of profielnaam:
-- die persoonsgegevens staan één keer op het gesprek.
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id text NOT NULL UNIQUE,
  direction text NOT NULL DEFAULT 'inbound',
  message_type text NOT NULL DEFAULT 'text',
  body text,
  media_id text,
  media_mime_type text,
  status text NOT NULL DEFAULT 'received',
  sent_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_direction_check CHECK (direction IN ('inbound','outbound')),
  CONSTRAINT whatsapp_messages_type_len CHECK (char_length(message_type) BETWEEN 1 AND 40),
  CONSTRAINT whatsapp_messages_body_len CHECK (body IS NULL OR char_length(body) <= 4000),
  CONSTRAINT whatsapp_messages_status_check CHECK (status IN ('received','read','archived'))
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_recent_idx
  ON public.whatsapp_conversations (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_idx
  ON public.whatsapp_messages (conversation_id, received_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_unread_idx
  ON public.whatsapp_messages (conversation_id) WHERE read_at IS NULL;

DROP TRIGGER IF EXISTS update_whatsapp_conversations_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.whatsapp_conversations FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_messages FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_conversations TO authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

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
  v_count integer;
BEGIN
  IF NOT public.can_read_whatsapp_inbox(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.whatsapp_messages
     SET read_at = now(),
         status = 'read'
   WHERE conversation_id = p_conversation_id
     AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_mark_conversation_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_ingest_message(
  p_wa_id text,
  p_profile_name text,
  p_wa_message_id text,
  p_message_type text,
  p_body text,
  p_media_id text,
  p_media_mime_type text,
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
  INSERT INTO public.whatsapp_conversations (wa_id, profile_name)
  VALUES (p_wa_id, NULLIF(left(COALESCE(p_profile_name, ''), 200), ''))
  ON CONFLICT (wa_id) DO UPDATE
    SET profile_name = COALESCE(EXCLUDED.profile_name, public.whatsapp_conversations.profile_name)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.whatsapp_messages (
    conversation_id, wa_message_id, direction, message_type, body,
    media_id, media_mime_type, status, sent_at, received_at
  )
  VALUES (
    v_conversation_id, p_wa_message_id, 'inbound',
    left(COALESCE(NULLIF(p_message_type, ''), 'unknown'), 40),
    left(p_body, 4000), p_media_id, p_media_mime_type, 'received',
    p_sent_at, v_received_at
  )
  ON CONFLICT (wa_message_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Alleen bij een werkelijk nieuw bericht, en nooit terugzetten naar ouder.
  IF v_rows > 0 THEN
    UPDATE public.whatsapp_conversations
       SET last_message_at = v_received_at,
           last_message_preview = left(COALESCE(p_preview, ''), 200)
     WHERE id = v_conversation_id
       AND (last_message_at IS NULL OR last_message_at < v_received_at);
  END IF;

  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_ingest_message(
  text, text, text, text, text, text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ingest_message(
  text, text, text, text, text, text, text, timestamptz, text
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
