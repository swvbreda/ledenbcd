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
     SET read_by_us_at = now(),
         status = CASE WHEN direction = 'inbound' THEN 'read' ELSE status END
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