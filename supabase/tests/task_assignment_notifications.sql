-- Volledig teruggedraaid via eindexceptie (geen verzending: pg_net-verzoeken vervallen bij rollback).
-- Verwacht: new=1 edit=1 same=1 reassign=2 to_a2=1 dup=2 unassign=2 complete_reopen=2 total_delta=2
--           a1_sees=1 a2_sees=1 member_sees=0 member_rpc=denied update/delete/insert=denied
DO $$
DECLARE a1 uuid; a2 uuid; mem uuid; t uuid; c0 int; c int; seen int; res text := '';
BEGIN
  SELECT user_id INTO a1 FROM user_roles WHERE role='admin' ORDER BY user_id LIMIT 1;
  SELECT user_id INTO a2 FROM user_roles WHERE role='admin' AND user_id<>a1 ORDER BY user_id LIMIT 1;
  SELECT user_id INTO mem FROM user_roles r WHERE role='user' AND NOT has_role(r.user_id,'admin') LIMIT 1;
  SELECT count(*) INTO c0 FROM task_notifications;
  INSERT INTO internal_tasks(title, assignee_id, created_by) VALUES ('rollbacktest', a1, a1) RETURNING id INTO t;
  SELECT count(*) INTO c FROM task_notifications WHERE task_id=t; res := res||' new='||c;
  UPDATE internal_tasks SET title='x2' WHERE id=t; SELECT count(*) INTO c FROM task_notifications WHERE task_id=t; res := res||' edit='||c;
  UPDATE internal_tasks SET assignee_id=a1 WHERE id=t; SELECT count(*) INTO c FROM task_notifications WHERE task_id=t; res := res||' same='||c;
  UPDATE internal_tasks SET assignee_id=a2 WHERE id=t; SELECT count(*) INTO c FROM task_notifications WHERE task_id=t; res := res||' reassign='||c;
  UPDATE internal_tasks SET assignee_id=a2 WHERE id=t; SELECT count(*) INTO c FROM task_notifications WHERE task_id=t; res := res||' dup='||c;
  UPDATE internal_tasks SET assignee_id=NULL WHERE id=t; SELECT count(*) INTO c FROM task_notifications WHERE task_id=t; res := res||' unassign='||c;
  UPDATE internal_tasks SET status='afgerond' WHERE id=t; UPDATE internal_tasks SET status='te_doen' WHERE id=t;
  SELECT count(*) INTO c FROM task_notifications WHERE task_id=t; res := res||' complete_reopen='||c;
  INSERT INTO internal_tasks(title, created_by) VALUES ('rollbacktest2', a1); SELECT count(*) INTO c FROM task_notifications; res := res||' total_delta='||(c-c0);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',a1,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM task_notifications WHERE task_id=t; res := res||' a1_sees='||seen;
  BEGIN UPDATE task_notifications SET title='hack' WHERE task_id=t; res := res||' update=allowed'; EXCEPTION WHEN insufficient_privilege THEN res := res||' update=denied'; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',a2,'role','authenticated')::text, true);
  SELECT count(*) INTO seen FROM task_notifications WHERE task_id=t; res := res||' a2_sees='||seen;
  IF mem IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',mem,'role','authenticated')::text, true);
    SELECT count(*) INTO seen FROM task_notifications; res := res||' member_sees='||seen;
    BEGIN PERFORM mark_task_notifications_read(array[gen_random_uuid()]); res := res||' member_rpc=allowed'; EXCEPTION WHEN insufficient_privilege THEN res := res||' member_rpc=denied'; END;
  END IF;
  RESET ROLE;
  RAISE EXCEPTION 'ROLLBACK_RESULT%', res;
END $$;
