CREATE FUNCTION public.board_minutes_can_status(p_task uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(auth.uid() IS NOT NULL AND public.board_minutes_can_read() AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) AND NOT EXISTS(SELECT 1 FROM public.account_access_revocations r WHERE r.user_id=u.id)) AND EXISTS(
 SELECT 1 FROM public.internal_tasks t JOIN public.board_minutes_action_links l ON l.task_id=t.id JOIN public.board_minutes_meetings m ON m.id=l.meeting_id WHERE t.id=p_task AND t.board_minutes_private AND t.project_id IS NULL AND t.source_system IS NULL AND m.tasks_enabled AND m.category='Bestuursvergaderingen' AND (public.has_role(auth.uid(),'admin') OR (EXISTS(SELECT 1 FROM public.board_minutes_current_board() b WHERE b.user_id=auth.uid()) AND (t.assignee_id=auth.uid() OR EXISTS(SELECT 1 FROM public.board_minutes_action_assignees a WHERE a.action_id=l.id AND a.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.board_minutes_action_board_members b WHERE b.action_id=l.id AND b.user_id=auth.uid()))))),false)
$$;
REVOKE ALL ON FUNCTION public.board_minutes_can_status(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.board_minutes_set_task_status(p_task uuid,p_completed boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_completed IS NULL THEN RAISE EXCEPTION 'Kies een taakstatus.' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.internal_tasks WHERE id=p_task FOR UPDATE;
 IF NOT public.board_minutes_can_status(p_task) THEN RAISE EXCEPTION 'Deze bestuurstaak mag je niet wijzigen.' USING ERRCODE='42501'; END IF;
 UPDATE public.internal_tasks SET status=CASE WHEN p_completed THEN 'afgerond' ELSE 'te_doen' END WHERE id=p_task AND status IS DISTINCT FROM CASE WHEN p_completed THEN 'afgerond' ELSE 'te_doen' END;
END $$;
REVOKE ALL ON FUNCTION public.board_minutes_set_task_status(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.board_minutes_set_task_status(uuid,boolean) TO authenticated;
DO $migration$ DECLARE body text; old text; BEGIN
 SELECT pg_get_functiondef('public.board_minutes_tasks(uuid)'::regprocedure) INTO body;
 old:='''task_id'',t.id,''status'',t.status';
 IF position(old IN body)=0 THEN RAISE EXCEPTION 'Unexpected minutes task projection'; END IF;
 body:=replace(body,old,'''task_id'',t.id,''can_status'',public.board_minutes_can_status(t.id),''status'',t.status');
 old:='''completed_name'',(SELECT s.name FROM public.board_minutes_task_staff() s WHERE s.user_id=t.completed_by)';
 IF position(old IN body)=0 THEN RAISE EXCEPTION 'Unexpected minutes completion projection'; END IF;
 body:=replace(body,old,'''completed_name'',coalesce((SELECT s.name FROM public.board_minutes_task_staff() s WHERE s.user_id=t.completed_by),(SELECT min(b.name) FROM public.board_minutes_action_board_members b WHERE b.action_id=l.id AND b.user_id=t.completed_by),(SELECT min(b.name) FROM public.board_minutes_current_board() b WHERE b.user_id=t.completed_by))');
 EXECUTE body;
END $migration$;