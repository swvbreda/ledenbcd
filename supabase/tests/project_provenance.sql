-- Volledig teruggedraaid via eindexceptie. Geen echte pushes (taken unassigned).
-- Laatste run: svc_project=bronimport svc_task=bronimport/mail:rb-1 dup=rejected svc_event_bronimport=1 admin_spoof=forced update_spoof=kept history=ok
--   project_origin_update=bronimport staff_names=2 notifs=0 member_read=0 member_staff=0 member_write=denied anon_read=denied anon_staff=denied
DO $$
DECLARE a1 uuid; a2 uuid; mem uuid; p uuid; t uuid; t2 uuid; r record; res text := ''; v text; c int;
BEGIN
  SELECT user_id INTO a1 FROM user_roles WHERE role='admin' ORDER BY user_id LIMIT 1;
  SELECT user_id INTO a2 FROM user_roles WHERE role='admin' AND user_id<>a1 ORDER BY user_id LIMIT 1;
  SELECT user_id INTO mem FROM user_roles x WHERE role='user' AND NOT has_role(x.user_id,'admin') LIMIT 1;

  -- Service-import: Bronimport + import_ref toegestaan
  INSERT INTO internal_projects(title, created_by, created_origin) VALUES ('rb prov', a1, 'medewerker') RETURNING id, created_origin INTO r;
  p := r.id; res := res || ' svc_project=' || r.created_origin;
  INSERT INTO internal_tasks(title, project_id, created_by, import_ref) VALUES ('rb svc', p, a1, 'mail:rb-1') RETURNING id, created_origin, import_ref INTO r;
  t := r.id; res := res || ' svc_task=' || r.created_origin || '/' || coalesce(r.import_ref,'null');
  BEGIN INSERT INTO internal_tasks(title, created_by, import_ref) VALUES ('rb dup', a1, 'mail:rb-1'); res := res || ' dup=ALLOWED';
  EXCEPTION WHEN unique_violation THEN res := res || ' dup=rejected'; END;
  SELECT count(*) INTO c FROM internal_project_events WHERE task_id=t AND actor_kind='bronimport'; res := res || ' svc_event_bronimport=' || c;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',a1,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO internal_tasks(title, project_id, created_by, created_origin, import_ref) VALUES ('rb admin', p, a2, 'bronimport', 'mail:spoof')
    RETURNING id, created_by, created_origin, import_ref INTO r;
  t2 := r.id;
  res := res || ' admin_spoof=' || CASE WHEN r.created_by=a1 AND r.created_origin='medewerker' AND r.import_ref IS NULL THEN 'forced' ELSE 'FAIL' END;
  UPDATE internal_tasks SET created_origin='medewerker', import_ref='mail:x', created_by=a1, title='rb svc2', priority='hoog', description='d' WHERE id=t
    RETURNING created_origin, import_ref, created_by INTO r;
  res := res || ' update_spoof=' || CASE WHEN r.created_origin='bronimport' AND r.import_ref='mail:rb-1' AND r.created_by=a1 THEN 'kept' ELSE 'FAIL' END;
  SELECT summary INTO v FROM internal_project_events WHERE task_id=t AND event_type='taak_gewijzigd' ORDER BY created_at DESC LIMIT 1;
  res := res || ' history=' || CASE WHEN v LIKE '%titel gewijzigd%' AND v LIKE '%omschrijving%' AND v LIKE '%prioriteit hoog%' THEN 'ok' ELSE 'FAIL:' || coalesce(v,'') END;
  UPDATE internal_projects SET created_origin='medewerker' WHERE id=p RETURNING created_origin INTO v;
  res := res || ' project_origin_update=' || v;
  SELECT count(*) INTO c FROM list_internal_staff_names() WHERE full_name IN ('Simone van Breda','Bernard van Nierop'); res := res || ' staff_names=' || c;
  SELECT count(*) INTO c FROM task_notifications WHERE task_id IN (t, t2); res := res || ' notifs=' || c;
  RESET ROLE;

  IF mem IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',mem,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO c FROM internal_tasks; res := res || ' member_read=' || c;
    SELECT count(*) INTO c FROM list_internal_staff_names(); res := res || ' member_staff=' || c;
    BEGIN INSERT INTO internal_tasks(title, created_by) VALUES ('rb mem', mem); res := res || ' member_write=ALLOWED';
    EXCEPTION WHEN insufficient_privilege OR others THEN res := res || ' member_write=denied'; END;
    RESET ROLE;
  END IF;
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
  BEGIN PERFORM 1 FROM internal_tasks LIMIT 1; res := res || ' anon_read=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res || ' anon_read=denied'; END;
  BEGIN PERFORM list_internal_staff_names(); res := res || ' anon_staff=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res || ' anon_staff=denied'; END;
  RESET ROLE;
  RAISE EXCEPTION 'ROLLBACK_RESULT:%', res;
END $$;
