-- All writes roll back; notifier disabled transactionally BEFORE any publication.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE public.member_announcements DISABLE TRIGGER notify_members_on_published_announcement;
DO $$
DECLARE a uuid; msg jsonb; parsed jsonb; n integer; content text:=E'  Echte eerste regel\n\nhttps://example.test/a\n  ';
BEGIN
 SELECT user_id INTO a FROM public.user_roles WHERE role='admin' ORDER BY user_id LIMIT 1;
 IF a IS NULL THEN RAISE EXCEPTION 'Test requires an existing admin'; END IF;
 IF EXISTS(SELECT 1 FROM public.whatsapp_announcement_publishers) THEN RAISE EXCEPTION 'Expected empty initial allowlist'; END IF;
 INSERT INTO public.whatsapp_announcement_publishers(phone,enabled,authorized_by) VALUES('+31999999999',true,a);
 msg:=jsonb_build_object('id','rollback-wa-allowed','from','31999999999','type','text','context',jsonb_build_object('forwarded',true),'text',jsonb_build_object('body',content));
 parsed:=jsonb_build_object('waMessageId',msg->>'id','waId',msg->>'from','messageType','text','body',content);
 PERFORM public.whatsapp_ingest_verified(msg,'1312061225331302',parsed);
 PERFORM public.whatsapp_ingest_verified(msg,'1312061225331302',parsed);
 SELECT count(*) INTO n FROM public.member_announcements WHERE id IN(SELECT announcement_id FROM public.whatsapp_announcement_decisions WHERE wa_message_id=msg->>'id') AND published AND body=content AND title='Echte eerste regel';
 IF n<>1 THEN RAISE EXCEPTION 'Allowed forwarded text must publish once with full original text'; END IF;
 -- Connector replay of the same provider id uses the same shared ledger.
 PERFORM public.whatsapp_connector_receive('rollback-connector','whatsapp.message',jsonb_build_object('entry',jsonb_build_array(jsonb_build_object('changes',jsonb_build_array(jsonb_build_object('value',jsonb_build_object('metadata',jsonb_build_object('phone_number_id','1312061225331302'),'messages',jsonb_build_array(msg))))))),jsonb_build_array(parsed));
 IF NOT public.whatsapp_connector_process('rollback-connector') THEN RAISE EXCEPTION 'Connector processing failed'; END IF;
 IF (SELECT count(*) FROM public.whatsapp_announcement_decisions WHERE wa_message_id=msg->>'id')<>1 THEN RAISE EXCEPTION 'Cross-path dedup failed'; END IF;
 msg:=jsonb_set(msg,'{id}','"rollback-wa-dm"') - 'context'; parsed:=jsonb_set(parsed,'{waMessageId}','"rollback-wa-dm"');
 PERFORM public.whatsapp_ingest_verified(msg,'1312061225331302',parsed);
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id='rollback-wa-dm' AND decision='not_forwarded' AND announcement_id IS NULL) THEN RAISE EXCEPTION 'Ordinary DM published'; END IF;
 msg:=jsonb_set(jsonb_set(msg,'{id}','"rollback-wa-untrusted"'),'{from}','"31888888888"'); parsed:=jsonb_set(jsonb_set(parsed,'{waMessageId}','"rollback-wa-untrusted"'),'{waId}','"31888888888"');
 PERFORM public.whatsapp_ingest_verified(msg,'1312061225331302',parsed);
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id='rollback-wa-untrusted' AND decision='not_allowed' AND announcement_id IS NULL) THEN RAISE EXCEPTION 'Untrusted sender published'; END IF;
 msg:=jsonb_set(jsonb_set(msg,'{id}','"rollback-wa-image"'),'{from}','"31999999999"') || '{"type":"image","context":{"forwarded":true}}';
 parsed:=jsonb_set(jsonb_set(parsed,'{waMessageId}','"rollback-wa-image"'),'{waId}','"31999999999"') || '{"messageType":"image"}';
 PERFORM public.whatsapp_ingest_verified(msg,'1312061225331302',parsed);
 IF NOT EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id='rollback-wa-image' AND decision='attachment' AND announcement_id IS NULL) THEN RAISE EXCEPTION 'Attachment published'; END IF;
 IF has_function_privilege('authenticated','public.whatsapp_publish_forwarded(jsonb,text)','EXECUTE') OR has_function_privilege('anon','public.whatsapp_ingest_verified(jsonb,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Publication exposed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE tablename IN('whatsapp_announcement_publishers','whatsapp_announcement_decisions') AND cmd='SELECT' AND qual LIKE '%has_role%admin%')<>2 THEN RAISE EXCEPTION 'Admin RLS missing'; END IF;
 -- Direct management denies anonymous without any session/role mutation.
 BEGIN PERFORM public.whatsapp_set_publisher('+31777777777',true); RAISE EXCEPTION 'Anonymous management allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
-- Force failure after the private ledger reservation. Entire ingestion/publication must undo.
CREATE FUNCTION pg_temp.fail_announcement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated failure'; END; $$;
CREATE TRIGGER isolated_announcement_failure BEFORE INSERT ON public.member_announcements FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_announcement();
DO $$ BEGIN
 BEGIN
  PERFORM public.whatsapp_ingest_verified('{"id":"rollback-failure","from":"31999999999","type":"text","context":{"forwarded":true},"text":{"body":"Fail"}}','1312061225331302','{"waMessageId":"rollback-failure","waId":"31999999999","messageType":"text","body":"Fail"}');
  RAISE EXCEPTION 'Expected transaction error';
 EXCEPTION WHEN raise_exception THEN
  IF EXISTS(SELECT 1 FROM public.whatsapp_messages WHERE wa_message_id='rollback-failure') OR EXISTS(SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id='rollback-failure') THEN RAISE EXCEPTION 'Partial transaction persisted'; END IF;
 END;
END; $$;
ROLLBACK;