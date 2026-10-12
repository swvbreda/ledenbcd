-- Draait volledig in een transactie met ROLLBACK; wijzigt geen gegevens.
BEGIN;
DO $$
DECLARE adm uuid; usr uuid; tid uuid; r record; ok boolean;
BEGIN
  SELECT user_id INTO adm FROM public.user_roles WHERE role='admin' LIMIT 1;
  usr := gen_random_uuid();
  SELECT t.id INTO tid FROM public.internal_tasks t WHERE source_system='topical' AND status<>'afgerond'
    AND NOT EXISTS (SELECT 1 FROM public.topical_task_links l WHERE l.task_id=t.id AND l.todo_completed_at IS NOT NULL AND l.planner_completed_at IS NOT NULL) LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true);
  -- 1. gewone update blijft geblokkeerd
  ok := false; BEGIN UPDATE public.internal_tasks SET status='afgerond' WHERE id=tid; EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL: plain update not blocked'; END IF;
  -- 2. audit-velden kunnen niet zelf gezet worden
  UPDATE public.internal_tasks SET local_only_completed_at=now(), local_only_completed_by=adm WHERE id=tid;
  IF (SELECT local_only_completed_at FROM public.internal_tasks WHERE id=tid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: audit forged'; END IF;
  -- 3. niet-admin geweigerd
  IF usr IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',usr,'role','authenticated')::text, true);
    ok := false; BEGIN PERFORM public.topical_complete_local_only(tid); EXCEPTION WHEN raise_exception THEN ok := true; END;
    IF NOT ok THEN RAISE EXCEPTION 'FAIL: non-admin allowed'; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true);
  END IF;
  -- 4. expliciete lokale afronding met audit, bron blijft
  PERFORM public.topical_complete_local_only(tid);
  SELECT * INTO r FROM public.internal_tasks WHERE id=tid;
  IF r.status<>'afgerond' OR r.local_only_completed_by<>adm OR r.local_only_completed_at IS NULL OR r.source_system<>'topical' THEN RAISE EXCEPTION 'FAIL: local-only'; END IF;
  -- 5. heropenen wist audit
  UPDATE public.internal_tasks SET status='te_doen' WHERE id=tid;
  SELECT * INTO r FROM public.internal_tasks WHERE id=tid;
  IF r.local_only_completed_at IS NOT NULL OR r.source_ref IS NULL THEN RAISE EXCEPTION 'FAIL: reopen'; END IF;
  RAISE NOTICE 'ALL PASS (task %)', tid;
END $$;
ROLLBACK;
