-- Full Mijn vragen / WhatsApp-link privacy verification on the ISOLATED fixture only (see support_fixture_extract.py).
-- Real catalog DDL/functions/policies/grants; every write rolls back. No network, no notifications.
\set ON_ERROR_STOP on
SELECT CASE WHEN current_user='lovable' AND inet_server_port() IS NULL AND current_setting('port')='55440' THEN true ELSE false END AS isolated \gset
\if :isolated
\else
\echo 'Use only the isolated local fixture database.'
\quit
\endif
BEGIN;
CREATE FUNCTION pg_temp.act(u uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN u IS NULL THEN '{"role":"anon"}' ELSE json_build_object('sub',u,'role','authenticated')::text END, true);
  PERFORM set_config('role', CASE WHEN u IS NULL THEN 'anon' ELSE 'authenticated' END, true); END $$;
CREATE FUNCTION pg_temp.owner() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('role','none',true); PERFORM set_config('request.jwt.claims','',true); END $$;
CREATE FUNCTION pg_temp.wa(p text, id text, body text, rcpt text DEFAULT '1312061225331302') RETURNS void LANGUAGE sql AS $$
  SELECT public.whatsapp_ingest_verified(
    jsonb_build_object('id',id,'from',p,'type','text','text',jsonb_build_object('body',body)), rcpt,
    jsonb_build_object('waMessageId',id,'waId',p,'messageType','text','body',body,'sentAt',now())) $$;
CREATE FUNCTION pg_temp.denied(sql text) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN
  EXECUTE sql; RETURN false; EXCEPTION WHEN insufficient_privilege THEN RETURN true; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO anon, authenticated;

DO $$
DECLARE adm uuid:=gen_random_uuid(); ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); ue uuid:=gen_random_uuid();
  ui uuid:=gen_random_uuid(); ul uuid:=gen_random_uuid(); un uuid:=gen_random_uuid(); u uuid;
  proj uuid; ta uuid; tw uuid; ma uuid; code text; code2 text; n int; r jsonb; r2 jsonb; pa text; i int;
  pubphone text := '31999999999'; pa_phone text := '31600000001'; pbrute text := '31600000009';
BEGIN
  -- Fixture seed (explicit admin so admin checks are never skipped).
  INSERT INTO auth.users(id,email) SELECT x, x||'@fixture.test' FROM unnest(ARRAY[adm,ua,ub,ue,ui,ul,un]) x;
  INSERT INTO public.user_roles(user_id,role) VALUES (adm,'admin'),(ue,'extern'),(ui,'inhuur');
  INSERT INTO public.members_data(id,member_type,data) VALUES (990001,'member','{}'),(990002,'member','{}'),(990003,'lead','{}'),(990004,'member','{}'),(990005,'member','{}');
  INSERT INTO public.member_profiles(user_id,member_id) VALUES (ua,990001),(ub,990002),(ul,990003),(ue,990004),(ui,990005);
  INSERT INTO public.internal_projects(title) VALUES ('Fixtureproject') RETURNING id INTO proj;
  INSERT INTO public.whatsapp_announcement_publishers(phone,enabled,authorized_by) VALUES ('+'||pubphone,true,adm);
  IF public.support_member_id(adm) IS NOT NULL OR public.support_member_id(ue) IS NOT NULL OR public.support_member_id(ui) IS NOT NULL
     OR public.support_member_id(ul) IS NOT NULL OR public.support_member_id(un) IS NOT NULL OR public.support_member_id(ua) IS NULL THEN RAISE EXCEPTION 'member resolution'; END IF;

  -- 1. Member A: own thread, project only from member RPC set.
  PERFORM pg_temp.act(ua);
  ta := public.support_create_thread('Vraag A','Tekst',proj,gen_random_uuid());
  IF NOT EXISTS (SELECT 1 FROM public.get_member_project_status() WHERE id=proj) THEN RAISE EXCEPTION 'project rpc'; END IF;
  BEGIN PERFORM public.support_create_thread('X','x',gen_random_uuid(),gen_random_uuid()); RAISE EXCEPTION 'unknown project accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  SELECT id INTO ma FROM public.support_messages WHERE thread_id=ta;
  pa := ta||'/'||ua||'/'||gen_random_uuid()||'.pdf';
  INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES ('support-attachments',pa,ua::text,'{"size":1000,"mimetype":"application/pdf"}');
  PERFORM public.support_add_attachment(ta,ma,pa,'a.pdf');
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE name=pa) THEN RAISE EXCEPTION 'A cannot read own file'; END IF;
  IF NOT pg_temp.denied(format('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES (%L,%L,%L)','support-attachments',ta||'/'||ua||'/x.html',ua)) THEN RAISE EXCEPTION 'html allowed'; END IF;
  BEGIN PERFORM public.support_add_attachment(ta,ma,ta||'/'||ua||'/'||gen_random_uuid()||'.pdf','missing.pdf'); RAISE EXCEPTION 'unuploaded file registered';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  code := public.support_wa_create_code();

  -- 2. Member B: no read/list/write/attach/reassign on A.
  PERFORM pg_temp.act(ub);
  SELECT count(*) INTO n FROM public.support_threads WHERE id=ta; IF n<>0 THEN RAISE EXCEPTION 'B reads A thread'; END IF;
  SELECT count(*) INTO n FROM public.support_messages WHERE thread_id=ta; IF n<>0 THEN RAISE EXCEPTION 'B reads A msgs'; END IF;
  SELECT count(*) INTO n FROM public.support_attachments WHERE thread_id=ta; IF n<>0 THEN RAISE EXCEPTION 'B reads A attachments'; END IF;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='support-attachments'; IF n<>0 THEN RAISE EXCEPTION 'B lists A files'; END IF;
  IF NOT pg_temp.denied(format('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES (%L,%L,%L)','support-attachments',ta||'/'||ub||'/'||gen_random_uuid()||'.pdf',ub)) THEN RAISE EXCEPTION 'B uploads into A thread'; END IF;
  IF NOT pg_temp.denied(format('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES (%L,%L,%L)','support-attachments',ta||'/'||ua||'/'||gen_random_uuid()||'.pdf',ub)) THEN RAISE EXCEPTION 'B uploads as A'; END IF;
  UPDATE storage.objects SET name=replace(name,ua::text,ub::text) WHERE name=pa; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'B reassigns file'; END IF;
  DELETE FROM storage.objects WHERE name=pa; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'B deletes file'; END IF;
  IF NOT pg_temp.denied(format('SELECT public.support_member_reply(%L,%L,%L)',ta,'x',gen_random_uuid())) THEN RAISE EXCEPTION 'B replies A'; END IF;
  IF NOT pg_temp.denied(format('SELECT public.support_add_attachment(%L,%L,%L,%L)',ta,ma,pa,'a.pdf')) THEN RAISE EXCEPTION 'B attaches A'; END IF;
  UPDATE public.support_threads SET user_id=ub WHERE id=ta; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'B reassigns thread'; END IF;
  UPDATE public.support_messages SET body='x' WHERE thread_id=ta; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'B edits A msgs'; END IF;
  IF NOT pg_temp.denied(format('INSERT INTO public.support_messages(thread_id,author_kind,channel,body) VALUES (%L,%L,%L,%L)',ta,'member','app','x')) THEN RAISE EXCEPTION 'direct insert'; END IF;
  IF NOT pg_temp.denied('SELECT public.support_admin_threads()') THEN RAISE EXCEPTION 'member admin list'; END IF;
  IF NOT pg_temp.denied(format('SELECT public.support_admin_set_status(%L,%L)',ta,'afgerond')) THEN RAISE EXCEPTION 'member set status'; END IF;
  IF NOT pg_temp.denied(format('SELECT public.support_member_id(%L)',ua)) THEN RAISE EXCEPTION 'generic lookup exposed'; END IF;
  IF NOT pg_temp.denied('SELECT * FROM public.whatsapp_link_codes') THEN RAISE EXCEPTION 'codes table readable'; END IF;

  PERFORM pg_temp.owner();
  IF (SELECT user_id FROM public.support_threads WHERE id=ta) <> ua THEN RAISE EXCEPTION 'thread owner changed'; END IF;
  -- 3. extern / inhuur / lead / non-member / anon denied.
  FOREACH u IN ARRAY ARRAY[ue,ui,ul,un] LOOP
    PERFORM pg_temp.act(u);
    IF NOT pg_temp.denied(format('SELECT public.support_create_thread(%L,%L,NULL,%L)','x','x',gen_random_uuid())) THEN RAISE EXCEPTION 'role % created thread', u; END IF;
    IF NOT pg_temp.denied('SELECT public.support_wa_create_code()') THEN RAISE EXCEPTION 'role % created code', u; END IF;
    IF NOT pg_temp.denied('SELECT public.support_admin_threads()') THEN RAISE EXCEPTION 'role % admin list', u; END IF;
    SELECT count(*) INTO n FROM public.support_threads; IF n<>0 THEN RAISE EXCEPTION 'role % reads threads', u; END IF;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='support-attachments'; IF n<>0 THEN RAISE EXCEPTION 'role % lists files', u; END IF;
  END LOOP;
  PERFORM pg_temp.act(NULL);
  IF NOT pg_temp.denied('SELECT count(*) FROM public.support_threads') THEN RAISE EXCEPTION 'anon reads threads'; END IF;
  IF NOT pg_temp.denied(format('SELECT public.support_create_thread(%L,%L,NULL,%L)','x','x',gen_random_uuid())) THEN RAISE EXCEPTION 'anon creates'; END IF;
  PERFORM pg_temp.owner();

  -- 4. Admin reads all.
  PERFORM pg_temp.act(adm);
  SELECT count(*) INTO n FROM public.support_threads WHERE id=ta; IF n<>1 THEN RAISE EXCEPTION 'admin cannot read'; END IF;
  SELECT count(*) INTO n FROM storage.objects WHERE name=pa; IF n<>1 THEN RAISE EXCEPTION 'admin cannot read file'; END IF;
  PERFORM pg_temp.owner();

  -- 5. Wrong recipient: no consume, no attempt, no link, no support row (both ingest paths).
  PERFORM pg_temp.wa(pa_phone,'fx-old','oud bericht vóór koppeling');
  PERFORM pg_temp.wa(pa_phone,'fx-wrongrcpt',code,'999999999999');
  IF EXISTS (SELECT 1 FROM public.whatsapp_link_codes WHERE user_id=ua AND used_at IS NOT NULL) THEN RAISE EXCEPTION 'wrong recipient consumed'; END IF;
  IF EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE phone=pa_phone) THEN RAISE EXCEPTION 'wrong recipient linked'; END IF;
  IF EXISTS (SELECT 1 FROM public.whatsapp_link_attempts WHERE phone=pa_phone) THEN RAISE EXCEPTION 'wrong recipient counted'; END IF;
  IF (SELECT body FROM public.whatsapp_messages WHERE wa_message_id='fx-wrongrcpt') <> '(koppelcode ontvangen)' THEN RAISE EXCEPTION 'wrong recipient not redacted'; END IF;
  PERFORM public.whatsapp_connector_receive('fx-conn-wrong','whatsapp.message',
    jsonb_build_object('entry',jsonb_build_array(jsonb_build_object('changes',jsonb_build_array(jsonb_build_object('value',jsonb_build_object('metadata',jsonb_build_object('phone_number_id','999999999999'))))))),
    jsonb_build_array(jsonb_build_object('waMessageId','fx-conn-wrong-m','waId',pa_phone,'messageType','text','body',code,'sentAt',now())));
  PERFORM public.whatsapp_connector_process('fx-conn-wrong');
  IF EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE phone=pa_phone) OR EXISTS (SELECT 1 FROM public.whatsapp_link_codes WHERE user_id=ua AND used_at IS NOT NULL) THEN RAISE EXCEPTION 'connector wrong recipient linked'; END IF;
  IF current_setting('bcd.wa_recipient', true) <> '' THEN RAISE EXCEPTION 'recipient flag leaked'; END IF;

  -- 6. Correct recipient links once; old chat stays invisible; reuse denied.
  PERFORM pg_temp.wa(pa_phone,'fx-code',code);
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE user_id=ua AND phone=pa_phone AND revoked_at IS NULL) THEN RAISE EXCEPTION 'link missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.whatsapp_messages WHERE body ILIKE '%'||code||'%') OR EXISTS (SELECT 1 FROM public.whatsapp_conversations WHERE last_message_preview ILIKE '%'||code||'%') THEN RAISE EXCEPTION 'code plaintext stored'; END IF;
  PERFORM pg_temp.wa('31600000002','fx-reuse',code);
  IF EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE phone='31600000002') THEN RAISE EXCEPTION 'code reused'; END IF;
  IF EXISTS (SELECT 1 FROM public.support_messages WHERE wa_message_id IN ('fx-old','fx-code','fx-wrongrcpt')) THEN RAISE EXCEPTION 'old/code visible'; END IF;
  PERFORM pg_temp.wa(pa_phone,'fx-new','nieuwe vraag');
  PERFORM pg_temp.wa(pa_phone,'fx-new','nieuwe vraag');
  SELECT count(*) INTO n FROM public.support_messages WHERE wa_message_id='fx-new'; IF n<>1 THEN RAISE EXCEPTION 'not idempotent'; END IF;
  SELECT thread_id INTO tw FROM public.support_messages WHERE wa_message_id='fx-new';
  PERFORM pg_temp.wa(pa_phone,'fx-new-wrongrcpt','via ander nummer','999999999999');
  IF EXISTS (SELECT 1 FROM public.support_messages WHERE wa_message_id='fx-new-wrongrcpt') THEN RAISE EXCEPTION 'wrong recipient routed'; END IF;
  PERFORM pg_temp.act(ub);
  SELECT count(*) INTO n FROM public.support_messages WHERE thread_id=tw; IF n<>0 THEN RAISE EXCEPTION 'B reads A whatsapp'; END IF;
  PERFORM pg_temp.act(ua);
  SELECT count(*) INTO n FROM public.support_messages WHERE thread_id=tw; IF n<>1 THEN RAISE EXCEPTION 'A cannot read own whatsapp'; END IF;
  PERFORM pg_temp.owner();

  -- 7. Expired code + brute force.
  PERFORM pg_temp.act(ub); code2 := public.support_wa_create_code(); PERFORM pg_temp.owner();
  UPDATE public.whatsapp_link_codes SET expires_at=now()-interval '1 second' WHERE user_id=ub;
  PERFORM pg_temp.wa(pbrute,'fx-exp',code2);
  IF EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE user_id=ub) THEN RAISE EXCEPTION 'expired code linked'; END IF;
  PERFORM pg_temp.act(ub); code2 := public.support_wa_create_code(); PERFORM pg_temp.owner();
  FOR i IN 1..5 LOOP PERFORM pg_temp.wa(pbrute,'fx-bf-'||i,'BCD-AAAAAAA'||i); END LOOP;
  PERFORM pg_temp.wa(pbrute,'fx-bf-ok',code2);
  IF EXISTS (SELECT 1 FROM public.whatsapp_member_links WHERE user_id=ub) THEN RAISE EXCEPTION 'brute force not blocked'; END IF;
  PERFORM pg_temp.wa(pbrute,'fx-bf-mal','BCD-xyz');
  PERFORM pg_temp.act(ub);
  BEGIN PERFORM public.support_wa_create_code(); PERFORM public.support_wa_create_code(); RAISE EXCEPTION 'code rate limit missing';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'rate_limited' THEN RAISE; END IF; END;
  PERFORM pg_temp.owner();

  -- 8. Admin replies: app reply is not WhatsApp; same client key = same item; outside window refused.
  PERFORM pg_temp.act(adm);
  PERFORM public.support_admin_reply(tw,'app-antwoord',gen_random_uuid());
  IF EXISTS (SELECT 1 FROM public.support_messages WHERE body='app-antwoord' AND (channel<>'app' OR wa_status IS NOT NULL)) THEN RAISE EXCEPTION 'app reply marked whatsapp'; END IF;
  r := public.support_wa_reserve_reply(tw,'wa','11111111-1111-1111-1111-111111111111');
  r2 := public.support_wa_reserve_reply(tw,'wa','11111111-1111-1111-1111-111111111111');
  IF NOT (r2->>'existing')::boolean OR r2->>'message_id' <> r->>'message_id' OR r2 ? 'phone' THEN RAISE EXCEPTION 'double reserve'; END IF;
  BEGIN PERFORM public.support_wa_reserve_reply(ta,'wa','11111111-1111-1111-1111-111111111111'); RAISE EXCEPTION 'key reused across threads';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM public.support_wa_finish_reply((r->>'message_id')::uuid,'unknown',NULL,'timeout');
  IF (SELECT wa_status FROM public.support_messages WHERE id=(r->>'message_id')::uuid) <> 'unknown' THEN RAISE EXCEPTION 'unknown not kept'; END IF;
  r2 := public.support_wa_reserve_reply(tw,'wa','11111111-1111-1111-1111-111111111111');
  IF r2->>'state' <> 'unknown' OR r2 ? 'phone' THEN RAISE EXCEPTION 'unknown re-offered for send'; END IF;
  BEGIN PERFORM public.support_wa_reserve_reply(ta,'wa',gen_random_uuid()); RAISE EXCEPTION 'app-only thread got whatsapp';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'no_whatsapp_link' THEN RAISE; END IF; END;
  PERFORM pg_temp.owner();
  UPDATE public.support_messages SET sent_at=now()-interval '25 hours' WHERE thread_id=tw AND author_kind='member';
  INSERT INTO public.whatsapp_messages(phone,direction,message_type,body,status,wa_message_id,timestamp) VALUES (pa_phone,'outbound','text','echo','sent','fx-echo',now());
  PERFORM pg_temp.act(adm);
  BEGIN PERFORM public.support_wa_reserve_reply(tw,'wa2',gen_random_uuid()); RAISE EXCEPTION 'outside window allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'outside_window' THEN RAISE; END IF; END;
  PERFORM pg_temp.owner();

  -- 9. Unlink / revoke / leaving stops routing and access.
  PERFORM pg_temp.act(ua); PERFORM public.support_wa_unlink(); PERFORM pg_temp.owner();
  PERFORM pg_temp.wa(pa_phone,'fx-after-unlink','na ontkoppelen');
  IF EXISTS (SELECT 1 FROM public.support_messages WHERE wa_message_id='fx-after-unlink') THEN RAISE EXCEPTION 'routed after unlink'; END IF;
  UPDATE public.members_data SET member_type='old' WHERE id=990001;
  PERFORM pg_temp.act(ua);
  SELECT count(*) INTO n FROM public.support_threads; IF n<>0 THEN RAISE EXCEPTION 'ex-member reads'; END IF;
  SELECT count(*) INTO n FROM storage.objects WHERE name=pa; IF n<>0 THEN RAISE EXCEPTION 'ex-member reads file'; END IF;
  PERFORM pg_temp.owner();

  -- 10. Publisher: link commands never published; normal text still published.
  SELECT count(*) INTO n FROM public.member_announcements;
  PERFORM pg_temp.wa(pubphone,'fx-pub-1','BCD-K7M2P9QX');
  PERFORM pg_temp.wa(pubphone,'fx-pub-2','bcd-abc');
  PERFORM pg_temp.wa(pubphone,'fx-pub-3','BCD-ZZZZZZZZ','999999999999');
  IF (SELECT count(*) FROM public.member_announcements) <> n THEN RAISE EXCEPTION 'publisher code published'; END IF;
  IF EXISTS (SELECT 1 FROM public.whatsapp_announcement_decisions WHERE wa_message_id LIKE 'fx-pub-%' AND decision<>'link_command') THEN RAISE EXCEPTION 'publisher decision'; END IF;
  PERFORM pg_temp.wa(pubphone,'fx-pub-normal','Echte aankondiging');
  IF (SELECT count(*) FROM public.member_announcements) <> n+1 THEN RAISE EXCEPTION 'normal publisher text not published'; END IF;
  IF EXISTS (SELECT 1 FROM public.support_messages WHERE wa_message_id='fx-pub-normal') THEN RAISE EXCEPTION 'announcement stored as question'; END IF;

  RAISE NOTICE 'support_privacy_full: all checks passed';
END $$;
ROLLBACK;
