-- Volledig teruggedraaid via eindexceptie. Geen echte pushes (pg_net-verzoeken vervallen bij rollback).
-- Verwacht: admin_crud=ok spoof_author=forced spoof_kind=forced spoof_time=forced bron_incomplete=rejected
--           claim1=t claim_steal=f claim_again=f claimer=a1 self_notif=0 completed_by=a1
--           cp_update_by=a1 events>0 bronimport=bronimport member_read=0 member_write=denied anon=denied
DO $$
DECLARE a1 uuid; a2 uuid; mem uuid; p uuid; t uuid; m record; cp uuid; ok boolean; c int; res text := ''; v text;
BEGIN
  SELECT user_id INTO a1 FROM user_roles WHERE role='admin' ORDER BY user_id LIMIT 1;
  SELECT user_id INTO a2 FROM user_roles WHERE role='admin' AND user_id<>a1 ORDER BY user_id LIMIT 1;
  SELECT user_id INTO mem FROM user_roles r WHERE role='user' AND NOT has_role(r.user_id,'admin') LIMIT 1;

  -- Bronimport via service tooling (geen auth.uid)
  INSERT INTO internal_projects(title, created_by) VALUES ('rollbacktest project', a1) RETURNING id INTO p;
  INSERT INTO internal_project_messages(project_id, kind, source_date, source_subject, source_mailbox, source_ref, last_action, next_step, author_id, author_kind)
  VALUES (p, 'bronupdate', now(), 'Onderwerp', 'info@x', 'msg-1', 'Gedaan', 'Volgende', a2, 'medewerker') RETURNING author_kind, author_id INTO m;
  res := res || ' bronimport=' || m.author_kind || (CASE WHEN m.author_id IS NULL THEN '' ELSE '!author' END);

  PERFORM set_config('request.jwt.claims', json_build_object('sub',a1,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- Admin CRUD
  UPDATE internal_projects SET project_plan='plan', budget_estimate=1000 WHERE id=p;
  INSERT INTO internal_tasks(title, project_id) VALUES ('rollbacktest taak', p) RETURNING id INTO t;
  INSERT INTO internal_project_checkpoints(project_id, title, remarks, created_by, created_at) VALUES (p, 'cp', 'opm', a2, '2000-01-01') RETURNING id INTO cp;
  SELECT CASE WHEN created_by=a1 AND created_at > '2001-01-01' THEN 'ok' ELSE 'SPOOFED' END INTO v FROM internal_project_checkpoints WHERE id=cp;
  res := res || ' admin_crud=' || v;
  -- Auditvervalsing
  INSERT INTO internal_project_messages(project_id, kind, body, author_id, author_kind, created_at)
  VALUES (p, 'bericht', 'hoi', a2, 'bronimport', '2000-01-01') RETURNING * INTO m;
  res := res || ' spoof_author=' || CASE WHEN m.author_id=a1 THEN 'forced' ELSE 'FAIL' END
             || ' spoof_kind=' || CASE WHEN m.author_kind='medewerker' THEN 'forced' ELSE 'FAIL' END
             || ' spoof_time=' || CASE WHEN m.created_at > '2001-01-01' THEN 'forced' ELSE 'FAIL' END;
  BEGIN INSERT INTO internal_project_messages(project_id, kind, source_subject) VALUES (p, 'bronupdate', 'x'); res := res||' bron_incomplete=ALLOWED';
  EXCEPTION WHEN check_violation THEN res := res||' bron_incomplete=rejected'; END;
  BEGIN UPDATE internal_project_messages SET body='hack' WHERE id=m.id; res := res||' msg_update=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res||' msg_update=denied'; END;
  -- Atomair oppakken
  ok := claim_internal_task(t); res := res||' claim1='||ok;
  SELECT count(*) INTO c FROM task_notifications WHERE task_id=t; res := res||' self_notif='||c;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',a2,'role','authenticated')::text, true);
  ok := claim_internal_task(t); res := res||' claim_steal='||ok;
  SELECT CASE WHEN assignee_id=a1 THEN 'a1' ELSE 'FAIL' END INTO v FROM internal_tasks WHERE id=t; res := res||' claimer='||v;
  UPDATE internal_project_checkpoints SET remarks='nieuw', updated_by=a1 WHERE id=cp;
  SELECT CASE WHEN updated_by=a2 THEN 'a2' ELSE 'FAIL' END INTO v FROM internal_project_checkpoints WHERE id=cp; res := res||' cp_update_by='||v;
  UPDATE internal_tasks SET status='afgerond', completed_by=a1 WHERE id=t;
  SELECT CASE WHEN completed_by=a2 THEN 'a2' ELSE 'FAIL' END INTO v FROM internal_tasks WHERE id=t; res := res||' completed_by='||v;
  ok := claim_internal_task(t); res := res||' claim_done='||ok;
  SELECT count(*) INTO c FROM internal_project_events WHERE project_id=p; res := res||' events='||c;
  BEGIN INSERT INTO internal_project_events(project_id, event_type, summary, actor_kind) VALUES (p,'x','x','systeem'); res := res||' event_insert=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res||' event_insert=denied'; END;

  -- Gewoon lid
  IF mem IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',mem,'role','authenticated')::text, true);
    SELECT (SELECT count(*) FROM internal_project_messages)+(SELECT count(*) FROM internal_project_checkpoints)+(SELECT count(*) FROM internal_project_events)+(SELECT count(*) FROM internal_projects) INTO c;
    res := res||' member_read='||c;
    BEGIN INSERT INTO internal_project_messages(project_id, kind, body) VALUES (p,'bericht','x'); res := res||' member_write=ALLOWED';
    EXCEPTION WHEN insufficient_privilege THEN res := res||' member_write=denied'; END;
    BEGIN PERFORM claim_internal_task(t); res := res||' member_claim=ALLOWED';
    EXCEPTION WHEN insufficient_privilege THEN res := res||' member_claim=denied'; END;
  END IF;
  -- Anoniem
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN PERFORM count(*) FROM internal_project_messages; res := res||' anon=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res||' anon=denied'; END;
  RESET ROLE;
  RAISE EXCEPTION 'ROLLBACK_RESULT%', res;
END $$;
