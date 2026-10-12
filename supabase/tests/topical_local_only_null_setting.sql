-- Regressie: verse sessie, bcd.topical_local_only nooit gezet (current_setting -> NULL).
-- Admin directe update status + vervalste eigen auditvelden moet geblokkeerd worden.
-- Draait in transactie met ROLLBACK; wijzigt geen gegevens.
BEGIN;
DO $$
DECLARE adm uuid; tid uuid; ok boolean; r record;
BEGIN
  IF current_setting('bcd.topical_local_only', true) IS NOT NULL AND current_setting('bcd.topical_local_only', true) <> '' THEN
    RAISE EXCEPTION 'SETUP: setting already present; run in fresh session';
  END IF;
  SELECT user_id INTO adm FROM public.user_roles WHERE role='admin' LIMIT 1;
  SELECT t.id INTO tid FROM public.internal_tasks t WHERE source_system='topical' AND status<>'afgerond'
    AND NOT EXISTS (SELECT 1 FROM public.topical_task_links l WHERE l.task_id=t.id AND l.todo_completed_at IS NOT NULL AND l.planner_completed_at IS NOT NULL) LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true);
  ok := false;
  BEGIN
    UPDATE public.internal_tasks SET status='afgerond', local_only_completed_at=now(), local_only_completed_by=adm WHERE id=tid;
  EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: forged audit + status with NULL setting was allowed'; END IF;
  SELECT * INTO r FROM public.internal_tasks WHERE id=tid;
  IF r.status='afgerond' OR r.local_only_completed_at IS NOT NULL THEN RAISE EXCEPTION 'FAIL: row changed'; END IF;
  -- Expliciete RPC blijft werken
  PERFORM public.topical_complete_local_only(tid);
  SELECT * INTO r FROM public.internal_tasks WHERE id=tid;
  IF r.status<>'afgerond' OR r.local_only_completed_by<>adm OR r.source_system<>'topical' THEN RAISE EXCEPTION 'FAIL: RPC'; END IF;
  RAISE NOTICE 'ALL PASS (task %)', tid;
END $$;
ROLLBACK;
