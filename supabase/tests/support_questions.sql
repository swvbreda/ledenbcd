-- Mijn vragen privacy + WhatsApp link/reply rules. Isolated fixture DB only; everything rolls back.
\set ON_ERROR_STOP on
SELECT CASE WHEN current_user='lovable' AND inet_server_port() IS NULL THEN true ELSE false END AS isolated \gset
\if :isolated
\else
\echo 'Use only the isolated local fixture database.'
\quit
\endif
BEGIN;
DO $$
DECLARE ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ul uuid := gen_random_uuid(); adm uuid;
  ta uuid; tb uuid; code text; n int; ok boolean; r jsonb;
BEGIN
  SELECT user_id INTO adm FROM public.user_roles WHERE role='admin' LIMIT 1;
  ALTER TABLE public.members_data DISABLE TRIGGER USER;
  INSERT INTO auth.users(id, email) VALUES (ua,'a@fixture.test'),(ub,'b@fixture.test'),(ul,'l@fixture.test');
  INSERT INTO public.members_data(id, member_type, data) VALUES (990001,'member','{}'),(990002,'member','{}'),(990003,'lead','{}');
  INSERT INTO public.member_profiles(user_id, member_id) VALUES (ua,990001),(ub,990002),(ul,990003);

  PERFORM set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ta := public.support_create_thread('Vraag A','Tekst',NULL,gen_random_uuid());
  BEGIN PERFORM public.support_create_thread('Vraag A','Tekst',gen_random_uuid(),gen_random_uuid()); RAISE EXCEPTION 'unknown project accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  code := public.support_wa_create_code();
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.support_threads WHERE id = ta; IF n<>0 THEN RAISE EXCEPTION 'B reads A thread'; END IF;
  SELECT count(*) INTO n FROM public.support_messages WHERE thread_id = ta; IF n<>0 THEN RAISE EXCEPTION 'B reads A messages'; END IF;
  BEGIN PERFORM public.support_member_reply(ta,'x',gen_random_uuid()); RAISE EXCEPTION 'B wrote A thread';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.support_messages(thread_id,author_kind,channel,body) VALUES (ta,'member','app','x'); RAISE EXCEPTION 'direct insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.support_threads SET user_id = ub WHERE id = ta; GET DIAGNOSTICS n = ROW_COUNT; IF n>0 THEN RAISE EXCEPTION 'reassign'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.support_add_attachment(ta,(SELECT id FROM public.support_messages LIMIT 1),ta||'/'||ub||'/00000000-0000-0000-0000-000000000000.pdf','x.pdf'); RAISE EXCEPTION 'B attached to A';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.support_admin_threads(); RAISE EXCEPTION 'member used admin list';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',ul,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.support_create_thread('Lead','x',NULL,gen_random_uuid()); RAISE EXCEPTION 'lead created thread';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  -- Old message before link stays invisible; wrong codes count as attempts; correct code links once.
  INSERT INTO public.whatsapp_messages(phone,direction,message_type,body,status,wa_message_id,timestamp) VALUES ('31600000001','inbound','text','oud bericht','received','fx-old',now()-interval '1 hour');
  INSERT INTO public.whatsapp_messages(phone,direction,message_type,body,status,wa_message_id) VALUES ('31600000001','inbound','text','BCD-AAAAAAAA','received','fx-wrong');
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_link_attempts WHERE phone='31600000001' AND NOT success) THEN RAISE EXCEPTION 'wrong code not counted'; END IF;
  INSERT INTO public.whatsapp_messages(phone,direction,message_type,body,status,wa_message_id) VALUES ('31600000001','inbound','text',code,'received','fx-code');
  IF (SELECT body FROM public.whatsapp_messages WHERE wa_message_id='fx-code') <> '(koppelcode ontvangen)' THEN RAISE EXCEPTION 'code not redacted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE user_id=ua AND phone='31600000001' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'link missing'; END IF;
  INSERT INTO public.whatsapp_messages(phone,direction,message_type,body,status,wa_message_id) VALUES ('31600000002','inbound','text',code,'received','fx-reuse');
  IF EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE phone='31600000002') THEN RAISE EXCEPTION 'code reused'; END IF;
  IF EXISTS (SELECT 1 FROM public.support_messages WHERE wa_message_id='fx-old') THEN RAISE EXCEPTION 'old chat visible'; END IF;
  INSERT INTO public.whatsapp_messages(phone,direction,message_type,body,status,wa_message_id) VALUES ('31600000001','inbound','text','nieuwe vraag','received','fx-new');
  INSERT INTO public.whatsapp_messages(phone,direction,message_type,body,status,wa_message_id) VALUES ('31600000001','inbound','text','nieuwe vraag','received','fx-new') ON CONFLICT DO NOTHING;
  SELECT count(*) INTO n FROM public.support_messages WHERE wa_message_id='fx-new'; IF n<>1 THEN RAISE EXCEPTION 'not idempotent'; END IF;
  SELECT thread_id INTO tb FROM public.support_messages WHERE wa_message_id='fx-new';

  -- Admin: app reply is not a WhatsApp send; reserve twice = one row; outside window refused.
  IF adm IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    PERFORM public.support_admin_reply(tb,'app-antwoord',gen_random_uuid());
    IF EXISTS (SELECT 1 FROM public.support_messages WHERE body='app-antwoord' AND (channel<>'app' OR wa_status IS NOT NULL)) THEN RAISE EXCEPTION 'app reply marked whatsapp'; END IF;
    r := public.support_wa_reserve_reply(tb,'wa','11111111-1111-1111-1111-111111111111');
    r := public.support_wa_reserve_reply(tb,'wa','11111111-1111-1111-1111-111111111111');
    IF NOT (r->>'existing')::boolean THEN RAISE EXCEPTION 'double submit reserved twice'; END IF;
    PERFORM public.support_wa_finish_reply((r->>'message_id')::uuid,'unknown',NULL,'timeout');
    IF (SELECT wa_status FROM public.support_messages WHERE id=(r->>'message_id')::uuid) <> 'unknown' THEN RAISE EXCEPTION 'unknown not kept'; END IF;
    RESET ROLE;
    UPDATE public.support_messages SET sent_at = now()-interval '25 hours' WHERE thread_id=tb AND author_kind='member';
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM public.support_wa_reserve_reply(tb,'wa2',gen_random_uuid()); RAISE EXCEPTION 'outside window allowed';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'outside_window' THEN RAISE; END IF; END;
    RESET ROLE;
  END IF;

  -- Member leaves: no further access and link revoked on next inbound.
  UPDATE public.members_data SET member_type='old' WHERE id=990001;
  INSERT INTO public.whatsapp_messages(phone,direction,message_type,body,status,wa_message_id) VALUES ('31600000001','inbound','text','na vertrek','received','fx-after');
  IF EXISTS (SELECT 1 FROM public.support_messages WHERE wa_message_id='fx-after') THEN RAISE EXCEPTION 'routed after leaving'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.support_threads; IF n<>0 THEN RAISE EXCEPTION 'ex-member still reads'; END IF;
  RESET ROLE;
  RAISE NOTICE 'support_questions: all checks passed';
END $$;
ROLLBACK;
