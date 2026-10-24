INSERT INTO user_roles VALUES('00000000-0000-0000-0000-000000000001','admin');
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000002','contact@example.test',null);
INSERT INTO members_data VALUES(1,'{"contacten":[{"naam":"Contact","email":"contact@example.test"}],"contactpersoon":"Contact","email":"contact@example.test"}');
INSERT INTO member_profiles VALUES(1,'00000000-0000-0000-0000-000000000002');
INSERT INTO member_allowed_emails VALUES(1,'contact@example.test');
DO $$ DECLARE p jsonb; op uuid; BEGIN
 BEGIN PERFORM contact_removal_prepare(1,'{"contacten":[],"contactpersoon":"","email":""}','00000000-0000-0000-0000-000000000002',false); RAISE EXCEPTION 'FAIL unauthorized'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 p:=contact_removal_prepare(1,'{"contacten":[],"contactpersoon":"","email":""}','00000000-0000-0000-0000-000000000001',false);
 IF (p->>'accounts')::int<>1 THEN RAISE EXCEPTION 'FAIL account count'; END IF;
 INSERT INTO member_profiles VALUES(2,'00000000-0000-0000-0000-000000000002');
 BEGIN PERFORM contact_removal_prepare(1,'{"contacten":[],"contactpersoon":"","email":""}','00000000-0000-0000-0000-000000000001',false); RAISE EXCEPTION 'FAIL shared'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='FAIL shared' THEN RAISE; END IF; END;
 DELETE FROM member_profiles WHERE member_id=2;
 BEGIN INSERT INTO member_edits VALUES(1,'{"contacten":[],"contactpersoon":"","email":""}',null,now()); RAISE EXCEPTION 'FAIL bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 p:=contact_removal_prepare(1,'{"contacten":[],"contactpersoon":"","email":""}','00000000-0000-0000-0000-000000000001',true); op:=(p->>'id')::uuid;
 PERFORM set_config('request.uid','00000000-0000-0000-0000-000000000002',true);
 BEGIN PERFORM contact_access_check(); RAISE EXCEPTION 'FAIL old jwt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.uid','',true);
 BEGIN PERFORM contact_removal_finish(op,'00000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'FAIL finish before delete'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='FAIL finish before delete' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM member_edits WHERE member_id=1) THEN RAISE EXCEPTION 'FAIL contact lost on failure'; END IF;
 UPDATE auth.users SET deleted_at=now() WHERE id='00000000-0000-0000-0000-000000000002';
 PERFORM contact_removal_finish(op,'00000000-0000-0000-0000-000000000001');
 PERFORM contact_removal_finish(op,'00000000-0000-0000-0000-000000000001');
 IF EXISTS(SELECT 1 FROM member_allowed_emails WHERE member_id=1) THEN RAISE EXCEPTION 'FAIL allow email'; END IF;
 IF NOT EXISTS(SELECT 1 FROM members_data WHERE id=1) THEN RAISE EXCEPTION 'FAIL lost history'; END IF;
 RAISE NOTICE 'CONTACT_REMOVAL_ASSERTS_OK';
END $$;

-- Multiset identity: equal names are not account identity; shared email is unsafe.
DO $$ DECLARE items jsonb; BEGIN
 SELECT jsonb_agg(x) INTO items FROM contact_removed_items(
  '{"contacten":[{"naam":"Alex","email":"a@example.test"},{"naam":"Alex","email":"b@example.test"}]}',
  '{"contacten":[{"naam":"Alex","email":"b@example.test"}]}') x;
 IF jsonb_array_length(items)<>1 OR items->0->>'email'<>'a@example.test' THEN RAISE EXCEPTION 'FAIL same name different accounts'; END IF;
 IF EXISTS(SELECT 1 FROM contact_removed_items(
  '{"contacten":[{"naam":"Alex","email":"a@example.test"},{"naam":"Bob","email":"b@example.test"}]}',
  '{"contacten":[{"naam":"Bob","email":"b@example.test"},{"naam":"Renamed","email":"a@example.test"}]}')) THEN RAISE EXCEPTION 'FAIL reorder rename'; END IF;
 IF EXISTS(SELECT 1 FROM contact_removed_items('{"contacten":[{"naam":"Alex","email":"a@example.test"}]}',
  '{"contacten":[{"naam":"Alex","email":"new@example.test"}]}')) THEN RAISE EXCEPTION 'FAIL unique email edit'; END IF;
 SELECT jsonb_agg(x) INTO items FROM contact_removed_items(
  '{"contacten":[{"naam":"Alex","email":"a@example.test"},{"naam":"Bob","email":"b@example.test"}]}',
  '{"contacten":[{"naam":"Bob","email":"b@example.test"},{"naam":"New","email":"new@example.test"}]}') x;
 IF jsonb_array_length(items)<>1 OR items->0->>'email'<>'a@example.test' THEN RAISE EXCEPTION 'FAIL remove plus add'; END IF;
 BEGIN PERFORM contact_removed_items(
  '{"contacten":[{"naam":"Alex","email":"shared@example.test"},{"naam":"Bob","email":"shared@example.test"}]}',
  '{"contacten":[{"naam":"Bob","email":"shared@example.test"}]}'); RAISE EXCEPTION 'FAIL shared email'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM contact_removed_items(
  '{"contacten":[{"naam":"Alex","email":"same@example.test"},{"naam":"Alex","email":"same@example.test"}]}',
  '{"contacten":[{"naam":"Alex","email":"same@example.test"}]}'); RAISE EXCEPTION 'FAIL duplicate multiplicity'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'CONTACT_MULTISET_ASSERTS_OK';
END $$;
-- Missing account, protected identity, ambiguous mapping, read-only previews.
INSERT INTO members_data VALUES(3,'{"contacten":[{"naam":"No login","email":"none@example.test"}]}');
INSERT INTO members_data VALUES(4,'{"contacten":[{"naam":"Protected","email":"protected@example.test"}]}');
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000004','protected@example.test',null);
INSERT INTO user_roles VALUES('00000000-0000-0000-0000-000000000004','admin');
INSERT INTO member_profiles VALUES(4,'00000000-0000-0000-0000-000000000004');
INSERT INTO members_data VALUES(5,'{"contacten":[{"naam":"Unknown","email":""}]}');
INSERT INTO member_profiles VALUES(5,'00000000-0000-0000-0000-000000000005');
DO $$ DECLARE p jsonb; BEGIN
 p:=contact_removal_prepare(3,'{"contacten":[]}','00000000-0000-0000-0000-000000000001',false);
 IF (p->>'accounts')::int<>0 OR (p->>'removed')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL missing account'; END IF;
 BEGIN PERFORM contact_removal_prepare(4,'{"contacten":[]}','00000000-0000-0000-0000-000000000001',false); RAISE EXCEPTION 'FAIL protected'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='FAIL protected' THEN RAISE; END IF; END;
 BEGIN PERFORM contact_removal_prepare(5,'{"contacten":[]}','00000000-0000-0000-0000-000000000001',false); RAISE EXCEPTION 'FAIL missing identity'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='FAIL missing identity' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','public.contact_removal_prepare(integer,jsonb,uuid,boolean)','execute') OR has_function_privilege('authenticated','public.contact_removal_prepare(integer,jsonb,uuid,boolean)','execute') THEN RAISE EXCEPTION 'FAIL RPC permission'; END IF;
 IF (SELECT count(*) FROM contact_removal_operations)<>1 THEN RAISE EXCEPTION 'FAIL preview mutated'; END IF;
 RAISE NOTICE 'CONTACT_REMOVAL_SECURITY_OK';
END $$;
