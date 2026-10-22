-- Verwacht één regel: RESULT ... ; alle checks 'ok'. Draai op geïsoleerde fixture.
\set ON_ERROR_STOP 1
INSERT INTO auth.users VALUES ('a7fce7fa-600b-48ef-8faf-7aea6918660a','simone@coffeeshopbond.nl'),
 ('15adafb2-cb6a-4212-8604-68d27814ba59','bernard@coffeeshopbond.nl'),
 ('99999999-0000-0000-0000-000000000001','bernard.oud@example.org'),
 ('99999999-0000-0000-0000-000000000002','andere.admin@example.org'),
 ('99999999-0000-0000-0000-000000000003','indiener@example.org');
INSERT INTO user_roles(user_id, role) VALUES ('a7fce7fa-600b-48ef-8faf-7aea6918660a','admin'),('15adafb2-cb6a-4212-8604-68d27814ba59','admin'),
 ('99999999-0000-0000-0000-000000000002','admin'),('99999999-0000-0000-0000-000000000003','user');
INSERT INTO board_members(naam,functie,email) VALUES ('Bernard','Bestuurder / Penningmeester','bernard@coffeeshopbond.nl'),('Bernard','Bestuurder / Penningmeester','bernard.oud@example.org');
DO $$
DECLARE s uuid := 'a7fce7fa-600b-48ef-8faf-7aea6918660a'; b uuid := '15adafb2-cb6a-4212-8604-68d27814ba59';
  sub uuid := '99999999-0000-0000-0000-000000000003'; d uuid; d2 uuid; c int; res text := ''; ok boolean;
BEGIN
  -- 1. standaard uit: geen meldingen
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d;
  SELECT count(*) INTO c FROM declaration_notifications; res := res||' off='||c;
  UPDATE declaration_push_settings SET enabled = true;
  -- 2. nieuwe indiening: precies Simone + Bernard (exact account), niet oud Bernard-account/andere admin
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d; res := res||' new='||c;
  SELECT array_agg(recipient_id ORDER BY recipient_id) = ARRAY[b,s] INTO ok FROM declaration_notifications WHERE declaration_id=d; res := res||' scope='||ok;
  -- 3. herhaald opslaan / status opnieuw pending: geen duplicaat
  UPDATE internal_declarations SET amount=20 WHERE id=d; UPDATE internal_declarations SET status='pending' WHERE id=d;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d; res := res||' resave='||c;
  -- 4. concept -> ingediend: één nieuwe set
  INSERT INTO internal_declarations(submitted_by,status) VALUES (sub,'concept') RETURNING id INTO d2;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d2; res := res||' concept='||c;
  UPDATE internal_declarations SET status='pending' WHERE id=d2;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d2; res := res||' submitted='||c;
  -- 5. eigen indiening door Simone: alleen Bernard
  PERFORM set_config('request.jwt.claims', json_build_object('sub',s)::text, true);
  INSERT INTO internal_declarations(submitted_by) VALUES (s) RETURNING id INTO d2;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d2 AND recipient_id=b; res := res||' self_other='||c;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d2 AND recipient_id=s; res := res||' self_skip='||c;
  -- 6. één goedkeuring door Bernard volstaat; andere admin mag niet
  PERFORM set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000002')::text, true);
  BEGIN UPDATE internal_declarations SET status='approved', reviewed_by='99999999-0000-0000-0000-000000000002', reviewed_at=now() WHERE id=d; res := res||' other_admin=allowed';
  EXCEPTION WHEN OTHERS THEN res := res||' other_admin=denied'; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',b)::text, true);
  UPDATE internal_declarations SET status='approved', reviewed_by=b, reviewed_at=now() WHERE id=d;
  SELECT status INTO res FROM (SELECT res||' bernard_approve='||status AS status FROM internal_declarations WHERE id=d) x;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d; res := res||' after_approve='||c;
  -- 7. bestaande goedgekeurde rijen worden niet opnieuw gemeld (geen backfill)
  UPDATE internal_declarations SET informer_status='error' WHERE id=d;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d; res := res||' no_backfill='||c;
  -- 8. Bernard verliest admin: geen ontvanger meer, indienen blijft werken
  DELETE FROM user_roles WHERE user_id=b; PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d2;
  SELECT count(*) INTO c FROM declaration_notifications WHERE declaration_id=d2; res := res||' revoked='||c;
  RAISE NOTICE 'RESULT%', res;
END $$;
-- 9. clients: lezen alleen eigen, geen schrijfrecht, geen recipients-RPC
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub','a7fce7fa-600b-48ef-8faf-7aea6918660a')::text, false);
SELECT 'simone_sees='||count(*)||' foreign='||count(*) FILTER (WHERE recipient_id<>'a7fce7fa-600b-48ef-8faf-7aea6918660a') FROM declaration_notifications;
DO $$ BEGIN INSERT INTO declaration_notifications(declaration_id,recipient_id,submission_no,event_key) VALUES (gen_random_uuid(),auth.uid(),9,'x'); RAISE NOTICE 'insert=allowed'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'insert=denied'; END $$;
DO $$ BEGIN UPDATE declaration_notifications SET push_status='sent'; RAISE NOTICE 'update=allowed'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'update=denied'; END $$;
DO $$ BEGIN PERFORM declaration_push_recipients(); RAISE NOTICE 'rpc=allowed'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'rpc=denied'; END $$;
DO $$ BEGIN UPDATE declaration_push_settings SET enabled=false; RAISE NOTICE 'settings_write=allowed'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'settings_write=denied'; END $$;
SELECT set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000003')::text, false);
SELECT 'member_sees='||count(*) FROM declaration_notifications;
RESET ROLE;
