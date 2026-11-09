ALTER TABLE public.board_minutes_action_links ADD COLUMN collective_board boolean NOT NULL DEFAULT false;
CREATE TABLE public.board_minutes_action_board_members(action_id uuid NOT NULL REFERENCES public.board_minutes_action_links(id),board_member_id uuid NOT NULL REFERENCES public.board_members(id),user_id uuid, name text NOT NULL,PRIMARY KEY(action_id,board_member_id));
GRANT SELECT ON public.board_minutes_action_board_members TO authenticated;
GRANT ALL ON public.board_minutes_action_board_members TO service_role;
ALTER TABLE public.board_minutes_action_board_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY minutes_board_responsibles_read ON public.board_minutes_action_board_members FOR SELECT TO authenticated USING(public.board_minutes_can_read());
CREATE FUNCTION public.board_minutes_current_board() RETURNS TABLE(board_member_id uuid,user_id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT b.id,CASE WHEN cardinality(a.admins)=1 THEN a.admins[1] WHEN cardinality(a.ids)=1 THEN a.ids[1] END,btrim(b.naam)
 FROM public.board_members b LEFT JOIN LATERAL(
 SELECT array_agg(u.id ORDER BY u.id) ids,array_agg(u.id ORDER BY u.id) FILTER(WHERE public.has_role(u.id,'admin')) admins
 FROM auth.users u WHERE (lower(btrim(b.email))=lower(u.email::text) OR lower(btrim(b.bond_email))=lower(u.email::text))
 AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) AND NOT EXISTS(SELECT 1 FROM public.account_access_revocations r WHERE r.user_id=u.id)
 ) a ON true WHERE b.type='bestuurslid' AND nullif(btrim(b.naam),'') IS NOT NULL
 $$;
REVOKE ALL ON FUNCTION public.board_minutes_current_board() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.board_minutes_assign_board(p_action uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE tid uuid; primary_user uuid; BEGIN
 SELECT task_id INTO tid FROM public.board_minutes_action_links WHERE id=p_action AND NOT manual_assignment FOR UPDATE;
 IF tid IS NULL THEN RETURN; END IF;
 DELETE FROM public.board_minutes_action_board_members WHERE action_id=p_action;
 INSERT INTO public.board_minutes_action_board_members SELECT p_action,board_member_id,user_id,name FROM public.board_minutes_current_board();
 DELETE FROM public.board_minutes_action_assignees WHERE action_id=p_action;
 INSERT INTO public.board_minutes_action_assignees SELECT DISTINCT p_action,user_id FROM public.board_minutes_action_board_members WHERE action_id=p_action AND user_id IS NOT NULL;
 UPDATE public.board_minutes_action_links SET collective_board=true,needs_assignment=NOT EXISTS(SELECT 1 FROM public.board_minutes_action_board_members WHERE action_id=p_action) OR EXISTS(SELECT 1 FROM public.board_minutes_action_board_members WHERE action_id=p_action AND user_id IS NULL) WHERE id=p_action;
 SELECT user_id INTO primary_user FROM public.board_minutes_action_board_members WHERE action_id=p_action AND user_id IS NOT NULL AND public.has_role(user_id,'admin') ORDER BY board_member_id LIMIT 1;
 UPDATE public.internal_tasks SET assignee_id=primary_user WHERE id=tid AND assignee_id IS DISTINCT FROM primary_user;
 END $$;
REVOKE ALL ON FUNCTION public.board_minutes_assign_board(uuid) FROM PUBLIC,anon,authenticated;
DO $migration$ DECLARE body text; old text; new text; BEGIN
 SELECT pg_get_functiondef('public.board_minutes_sync_tasks(uuid,boolean)'::regprocedure) INTO body;
 old:='IF aid IS NOT NULL THEN i:=i+1; CONTINUE; END IF;';
 new:='IF aid IS NOT NULL THEN IF lower(btrim(r->>''owner''))=''bestuur'' THEN PERFORM public.board_minutes_assign_board(aid); END IF; i:=i+1; CONTINUE; END IF;';
 IF position(old IN body)=0 THEN RAISE EXCEPTION 'Unexpected sync definition'; END IF; body:=replace(body,old,new);
 old:='IF NOT(SELECT manual_assignment FROM public.board_minutes_action_links WHERE id=aid) THEN people:=';
 new:='IF lower(btrim(r->>''owner''))=''bestuur'' AND NOT(SELECT manual_assignment FROM public.board_minutes_action_links WHERE id=aid) THEN PERFORM public.board_minutes_assign_board(aid); ELSIF NOT(SELECT manual_assignment FROM public.board_minutes_action_links WHERE id=aid) THEN UPDATE public.board_minutes_action_links SET collective_board=false WHERE id=aid; DELETE FROM public.board_minutes_action_board_members WHERE action_id=aid; people:=';
 IF position(old IN body)=0 THEN RAISE EXCEPTION 'Unexpected assignment definition'; END IF; EXECUTE replace(body,old,new);
 SELECT pg_get_functiondef('public.board_minutes_task_assignment(uuid,uuid[],boolean)'::regprocedure) INTO body;
 old:='manual_assignment=true,needs_assignment=';new:='manual_assignment=true,collective_board=false,needs_assignment=';
 IF position(old IN body)=0 THEN RAISE EXCEPTION 'Unexpected manual definition'; END IF; EXECUTE replace(body,old,new);
 SELECT pg_get_functiondef('public.board_minutes_tasks(uuid)'::regprocedure) INTO body;
 old:='''needs_assignment'',l.needs_assignment,''assignees'',coalesce(';new:='''needs_assignment'',l.needs_assignment,''collective_board'',l.collective_board,''board_responsibles'',coalesce((SELECT jsonb_agg(jsonb_build_object(''user_id'',b.user_id,''name'',b.name) ORDER BY b.name) FROM public.board_minutes_action_board_members b WHERE b.action_id=l.id),''[]''::jsonb),''assignees'',coalesce(';
 IF position(old IN body)=0 THEN RAISE EXCEPTION 'Unexpected projection definition'; END IF; EXECUTE replace(body,old,new);
 END $migration$;