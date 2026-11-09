-- Isolated PostgreSQL only; synthetic data, no app session or production mutation.
BEGIN;
INSERT INTO public.board_minutes_meetings(id,source) SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'topical' FROM generate_series(1,4) i;
INSERT INTO public.board_minutes_versions(id,meeting_id,version,meeting_date,report)
SELECT id,id,1,CASE right(id::text,1) WHEN '1' THEN '2026-04-02'::date WHEN '2' THEN '2026-05-07'::date WHEN '3' THEN '2026-06-04'::date ELSE '2026-11-06'::date END,CASE WHEN right(id::text,1)='3' THEN '' ELSE 'Synthetic unchanged source' END FROM public.board_minutes_meetings;
INSERT INTO public.board_minutes_import_details SELECT id,jsonb_build_object('status',CASE WHEN right(id::text,1)='4' THEN 'concept' ELSE 'historisch-onbevestigd' END,'reportKind',CASE right(id::text,1) WHEN '1' THEN 'ai-report' WHEN '2' THEN 'brief-notes' WHEN '3' THEN 'agenda-only' ELSE 'summary' END,'reportMissing',right(id::text,1)='3') FROM public.board_minutes_versions;
INSERT INTO public.board_minutes_files SELECT id FROM public.board_minutes_versions;
DO $$ DECLARE ids uuid[]:=ARRAY['00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000002'::uuid]; actor text; n integer; before_text text; BEGIN
FOREACH actor IN ARRAY ARRAY['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',''] LOOP
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 BEGIN PERFORM public.board_minutes_adopt_historical(ids,true); RAISE EXCEPTION 'Unauthorized adoption allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END LOOP;
PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
BEGIN PERFORM public.board_minutes_adopt_historical(ids,false); RAISE EXCEPTION 'Unconfirmed allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unconfirmed allowed' THEN RAISE; END IF; END;
BEGIN PERFORM public.board_minutes_adopt_historical(ids||ARRAY['00000000-0000-0000-0000-000000000003'::uuid],true); RAISE EXCEPTION 'Agenda allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
BEGIN PERFORM public.board_minutes_adopt_historical(ids||ARRAY['00000000-0000-0000-0000-000000000004'::uuid],true); RAISE EXCEPTION 'Concept allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
BEGIN PERFORM public.board_minutes_adopt_historical(ids[1:1],true); RAISE EXCEPTION 'Stale preview allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
SELECT string_agg(report,'|' ORDER BY id) INTO before_text FROM public.board_minutes_versions;
n:=public.board_minutes_adopt_historical(ids,true); IF n<>2 THEN RAISE EXCEPTION 'Wrong count'; END IF;
IF (SELECT count(*) FROM public.board_minutes_adoptions)<>2 OR EXISTS(SELECT 1 FROM public.board_minutes_adoptions WHERE adopted_by<>auth.uid() OR adopted_at<transaction_timestamp() OR confirmation_origin NOT LIKE 'Gebruikersopdracht:%') THEN RAISE EXCEPTION 'Invalid confirmation provenance'; END IF;
IF before_text IS DISTINCT FROM (SELECT string_agg(report,'|' ORDER BY id) FROM public.board_minutes_versions) OR (SELECT count(*) FROM public.board_minutes_files)<>4 THEN RAISE EXCEPTION 'Source mutated'; END IF;
BEGIN PERFORM public.board_minutes_adopt_historical(ids,true); RAISE EXCEPTION 'Replay allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
RAISE NOTICE 'PASS: current admin confirmation, complete preview, exclusions, immutable source, replay and unauthorized denial';
END $$;
ROLLBACK;