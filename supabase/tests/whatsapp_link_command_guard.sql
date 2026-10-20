-- Regression: link commands from an announcement publisher are never published or stored in plaintext.
-- Runs inside a transaction that is always rolled back (no real data, no sends).
BEGIN;
DO $$
DECLARE pub text; digits text; codes text[] := ARRAY['BCD-K7M2P9QX','bcd-abc','BCD-ZZZZZZZZ']; c text; n int; i int := 0; mid text;
BEGIN
  SELECT phone INTO pub FROM public.whatsapp_announcement_publishers WHERE enabled LIMIT 1;
  IF pub IS NULL THEN RAISE NOTICE 'no publisher; skipped'; RETURN; END IF;
  digits := regexp_replace(pub, '\D', '', 'g');
  -- expired code row for the third variant
  INSERT INTO public.whatsapp_link_codes(user_id, code_hash, expires_at)
    VALUES (gen_random_uuid(), encode(extensions.digest('BCD-ZZZZZZZZ','sha256'),'hex'), now() - interval '1 minute');
  SELECT count(*) INTO n FROM public.member_announcements;
  FOREACH c IN ARRAY codes LOOP
    i := i + 1; mid := 'test-linkguard-' || i || '-' || gen_random_uuid();
    PERFORM public.whatsapp_ingest_verified(
      jsonb_build_object('id', mid, 'from', digits, 'type', 'text', 'text', jsonb_build_object('body', c)),
      '1312061225331302',
      jsonb_build_object('waMessageId', mid, 'waId', digits, 'messageType', 'text', 'body', c, 'sentAt', now()));
    IF EXISTS (SELECT 1 FROM public.whatsapp_messages WHERE wa_message_id = mid AND body ILIKE '%' || c || '%') THEN RAISE EXCEPTION 'plaintext in inbox: %', i; END IF;
    IF EXISTS (SELECT 1 FROM public.whatsapp_conversations WHERE phone = digits AND last_message_preview ILIKE '%' || c || '%') THEN RAISE EXCEPTION 'plaintext in preview: %', i; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id = mid AND decision = 'link_command' AND announcement_id IS NULL) THEN RAISE EXCEPTION 'decision missing: %', i; END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.member_announcements) <> n THEN RAISE EXCEPTION 'link command published'; END IF;
  IF EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE phone = digits AND revoked_at IS NULL AND verified_at > now() - interval '1 minute') THEN RAISE EXCEPTION 'invalid code linked'; END IF;
  -- legacy path (raw payload only) also refuses
  mid := 'test-linkguard-legacy-' || gen_random_uuid();
  INSERT INTO public.whatsapp_messages(phone, direction, message_type, body, wa_message_id) VALUES (digits, 'inbound', 'text', 'BCD-K7M2P9QX', mid);
  PERFORM public.whatsapp_publish_forwarded(jsonb_build_object('id', mid, 'from', digits, 'type', 'text', 'text', jsonb_build_object('body', 'BCD-K7M2P9QX')), '1312061225331302');
  IF (SELECT count(*) FROM public.member_announcements) <> n THEN RAISE EXCEPTION 'legacy route published code'; END IF;
  -- normal publisher own text still publishes
  mid := 'test-linkguard-normal-' || gen_random_uuid();
  PERFORM public.whatsapp_ingest_verified(
    jsonb_build_object('id', mid, 'from', digits, 'type', 'text', 'text', jsonb_build_object('body', 'Testaankondiging')),
    '1312061225331302',
    jsonb_build_object('waMessageId', mid, 'waId', digits, 'messageType', 'text', 'body', 'Testaankondiging', 'sentAt', now()));
  IF (SELECT count(*) FROM public.member_announcements) <> n + 1 THEN RAISE EXCEPTION 'normal publisher text not published'; END IF;
  -- generic per-uid lookup not callable by authenticated
  IF has_function_privilege('authenticated', 'public.support_member_id(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'support_member_id exposed'; END IF;
  RAISE NOTICE 'link command guard OK';
END $$;
ROLLBACK;
