-- Geïsoleerde fixture; elke check gooit 'FAIL: <label>' en stopt (ON_ERROR_STOP) bij verkeerde uitkomst.
\set ON_ERROR_STOP 1
CREATE FUNCTION pg_temp.assert_ok(b boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF b IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END $$;
INSERT INTO auth.users VALUES ('a7fce7fa-600b-48ef-8faf-7aea6918660a','simone@coffeeshopbond.nl'),
 ('15adafb2-cb6a-4212-8604-68d27814ba59','bernard@coffeeshopbond.nl'),
 ('99999999-0000-0000-0000-000000000001','bernard.oud@example.org'),
 ('99999999-0000-0000-0000-000000000002','andere.admin@example.org'),
 ('99999999-0000-0000-0000-000000000003','indiener@example.org');
INSERT INTO user_roles(user_id, role) VALUES ('a7fce7fa-600b-48ef-8faf-7aea6918660a','admin'),('15adafb2-cb6a-4212-8604-68d27814ba59','admin'),
 ('99999999-0000-0000-0000-000000000002','admin'),('99999999-0000-0000-0000-000000000003','user');
INSERT INTO board_members(naam,functie,email) VALUES ('Bernard','Bestuurder / Penningmeester','bernard@coffeeshopbond.nl'),('Bernard','Bestuurder / Penningmeester','bernard.oud@example.org');
INSERT INTO cron.job(jobname, active) VALUES ('declaration-push-queue', false);
DO $$
DECLARE s uuid := 'a7fce7fa-600b-48ef-8faf-7aea6918660a'; b uuid := '15adafb2-cb6a-4212-8604-68d27814ba59';
  sub uuid := '99999999-0000-0000-0000-000000000003'; d uuid; d2 uuid; c int; st text; r record; tok uuid; ok boolean;
BEGIN
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d;
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_notifications) = 0, 'standaard uit: geen meldingen');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_push_claim(10)) = 0, 'uit: geen claim');
  UPDATE declaration_push_settings SET enabled = true;
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d;
  PERFORM pg_temp.assert_ok((SELECT array_agg(recipient_id ORDER BY recipient_id) = ARRAY[b,s] FROM declaration_notifications WHERE declaration_id=d), 'precies Simone+Bernard');
  PERFORM pg_temp.assert_ok(NOT (SELECT active FROM cron.job), 'niet gewapend: wekker blijft uit');
  UPDATE internal_declarations SET amount=20 WHERE id=d; UPDATE internal_declarations SET status='pending' WHERE id=d;
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_notifications WHERE declaration_id=d) = 2, 'opnieuw opslaan geen duplicaat');
  INSERT INTO internal_declarations(submitted_by,status) VALUES (sub,'concept') RETURNING id INTO d2;
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_notifications WHERE declaration_id=d2) = 0, 'concept geen melding');
  UPDATE internal_declarations SET status='pending' WHERE id=d2;
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_notifications WHERE declaration_id=d2) = 2, 'concept->ingediend 2');
  -- eigen indiening Simone én Bernard: beiden ontvangen
  PERFORM set_config('request.jwt.claims', json_build_object('sub',s)::text, true);
  INSERT INTO internal_declarations(submitted_by) VALUES (s) RETURNING id INTO d2;
  PERFORM pg_temp.assert_ok((SELECT array_agg(recipient_id ORDER BY recipient_id) = ARRAY[b,s] FROM declaration_notifications WHERE declaration_id=d2), 'eigen indiening Simone: 2');
  PERFORM set_config('request.jwt.claims', json_build_object('sub',b)::text, true);
  INSERT INTO internal_declarations(submitted_by) VALUES (b) RETURNING id INTO d2;
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_notifications WHERE declaration_id=d2) = 2, 'eigen indiening Bernard: 2');
  -- goedkeuring: andere admin geweigerd, Bernard volstaat
  PERFORM set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000002')::text, true);
  ok := false;
  BEGIN UPDATE internal_declarations SET status='approved', reviewed_by='99999999-0000-0000-0000-000000000002', reviewed_at=now() WHERE id=d;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  PERFORM pg_temp.assert_ok(ok, 'andere admin kan niet goedkeuren');
  PERFORM set_config('request.jwt.claims', json_build_object('sub',b)::text, true);
  UPDATE internal_declarations SET status='approved', reviewed_by=b, reviewed_at=now() WHERE id=d;
  PERFORM pg_temp.assert_ok((SELECT status FROM internal_declarations WHERE id=d) = 'approved', 'Bernard keurt goed');
  UPDATE internal_declarations SET informer_status='error' WHERE id=d;
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_notifications WHERE declaration_id=d) = 2, 'geen backfill na goedkeuring');
  -- claim/lease/finish
  DELETE FROM declaration_notifications;
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d2;
  SELECT * INTO r FROM declaration_push_claim(1, d2);
  PERFORM pg_temp.assert_ok(r.lock_token IS NOT NULL AND r.push_attempts = 1, 'claim geeft lease');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_push_claim(10, d2)) = 1, 'geclaimde rij niet opnieuw geclaimd');
  PERFORM pg_temp.assert_ok(NOT declaration_push_finish(r.id, gen_random_uuid(), 'sent', 1, 1, NULL), 'verkeerde token geweigerd');
  PERFORM pg_temp.assert_ok(declaration_push_finish(r.id, r.lock_token, 'failed', 0, 1, '500'), 'geldige finish');
  PERFORM pg_temp.assert_ok(NOT declaration_push_finish(r.id, r.lock_token, 'sent', 1, 1, NULL), 'tweede finish geweigerd');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_push_claim(10, d2) WHERE id = r.id) = 0, 'failed wacht op backoff');
  UPDATE declaration_notifications SET push_last_attempt_at = now() - interval '10 minutes' WHERE id = r.id;
  SELECT lock_token INTO tok FROM declaration_push_claim(10, d2) WHERE id = r.id;
  PERFORM pg_temp.assert_ok(tok IS NOT NULL, 'failed na backoff opnieuw');
  -- verlopen lease: unknown, geen herhaling, stale finish geweigerd
  UPDATE declaration_notifications SET lease_until = now() - interval '1 second' WHERE id = r.id;
  PERFORM pg_temp.assert_ok(NOT declaration_push_finish(r.id, tok, 'sent', 1, 1, NULL), 'verlopen lease finish geweigerd');
  PERFORM declaration_push_claim(10, d2);
  PERFORM pg_temp.assert_ok((SELECT push_status FROM declaration_notifications WHERE id = r.id) = 'unknown', 'verlopen wordt unknown');
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_push_claim(10, d2) WHERE id = r.id) = 0, 'unknown nooit opnieuw');
  UPDATE declaration_notifications SET push_status='failed', push_attempts=5, push_last_attempt_at = now() - interval '1 day' WHERE id <> r.id;
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM declaration_push_claim(10)) = 0, 'max 5 pogingen');
  -- wekker: gewapend + secret -> één callback zonder actor; uit -> uit
  DELETE FROM declaration_notifications;
  UPDATE declaration_push_settings SET scheduler_armed = true;
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d2;
  PERFORM pg_temp.assert_ok((SELECT active FROM cron.job), 'indienen wekt bestaande job');
  PERFORM declaration_push_scheduler_tick();
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM net.calls) = 0 AND NOT (SELECT active FROM cron.job), 'zonder secret geen callback en job uit');
  INSERT INTO vault.secrets VALUES ('internal_webhook_secret');
  UPDATE cron.job SET active = true;
  PERFORM declaration_push_scheduler_tick();
  PERFORM pg_temp.assert_ok((SELECT count(*) = 1 AND bool_and(body = '{}'::jsonb) FROM net.calls), 'één callback zonder body');
  UPDATE declaration_push_settings SET scheduler_armed = false;
  PERFORM declaration_push_scheduler_tick();
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM net.calls) = 1 AND NOT (SELECT active FROM cron.job), 'ontwapend: geen callback, job uit');
  UPDATE declaration_push_settings SET scheduler_armed = false;
  -- Bernard verliest admin: geen ontvanger; fout in meldingslogica blokkeert indienen niet
  DELETE FROM user_roles WHERE user_id=b; PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d2;
  PERFORM pg_temp.assert_ok((SELECT array_agg(recipient_id) = ARRAY[s] FROM declaration_notifications WHERE declaration_id=d2), 'ingetrokken Bernard geen ontvanger');
  ALTER TABLE declaration_notifications RENAME TO declaration_notifications_x;
  INSERT INTO internal_declarations(submitted_by) VALUES (sub) RETURNING id INTO d2;
  ALTER TABLE declaration_notifications_x RENAME TO declaration_notifications;
  PERFORM pg_temp.assert_ok((SELECT count(*) FROM internal_declarations WHERE id=d2) = 1, 'opgeslagen ondanks meldingsfout');
  INSERT INTO user_roles(user_id, role) VALUES (b, 'admin');
  RAISE NOTICE 'SQL_ASSERTS_OK';
END $$;
-- clients: alleen eigen lezen, geen schrijven, geen service-RPC's
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub','a7fce7fa-600b-48ef-8faf-7aea6918660a')::text, false);
SELECT pg_temp.assert_ok(count(*) FILTER (WHERE recipient_id <> auth.uid()) = 0, 'alleen eigen meldingen') FROM declaration_notifications;
DO $$
DECLARE f text; denied boolean;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    $q$INSERT INTO declaration_notifications(declaration_id,recipient_id,submission_no,event_key) VALUES (gen_random_uuid(),auth.uid(),9,'x')$q$,
    $q$UPDATE declaration_notifications SET push_status='sent'$q$,
    $q$UPDATE declaration_push_settings SET enabled=false$q$,
    $q$SELECT declaration_push_recipients()$q$,
    $q$SELECT * FROM declaration_push_claim(10)$q$,
    $q$SELECT declaration_push_finish(gen_random_uuid(),gen_random_uuid(),'sent',1,1,null)$q$,
    $q$SELECT declaration_push_scheduler_tick()$q$] LOOP
    denied := false;
    BEGIN EXECUTE f; EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL: client mocht %', f; END IF;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000003')::text, false);
SELECT pg_temp.assert_ok(count(*) = 0, 'lid ziet niets') FROM declaration_notifications;
RESET ROLE;
\echo CLIENT_ASSERTS_OK
