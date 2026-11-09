-- Isolated synthetic PostgreSQL fixture only; no hosted identities or documents.
BEGIN;
DO $$ DECLARE vid uuid; actor uuid; n int; d jsonb:='{"status":"historisch-onbevestigd","reviewRequired":true,"reportMissing":true}'; BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true); SET LOCAL ROLE authenticated;
 vid:=public.board_minutes_import_revision('topical','synthetic-import','2026-04-02','Synthetic','', '[]','[]',NULL,repeat('a',64),d,'Agenda only');
 IF vid IS DISTINCT FROM public.board_minutes_import_revision('topical','synthetic-import','2026-04-02','Synthetic','', '[]','[]',NULL,repeat('a',64),d,'Agenda only') THEN RAISE EXCEPTION 'Import duplicated'; END IF;
 IF EXISTS(SELECT 1 FROM public.board_minutes_adoptions WHERE version_id=vid) THEN RAISE EXCEPTION 'Historical adoption fabricated'; END IF;
 BEGIN INSERT INTO public.board_minutes_import_details(version_id,details) VALUES(vid,d); RAISE EXCEPTION 'Direct provenance write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true); SET LOCAL ROLE authenticated;
 SELECT count(*) INTO n FROM public.board_minutes_import_details WHERE source_text ILIKE '%agenda%'; IF n<>1 THEN RAISE EXCEPTION 'Board source read failed'; END IF;
 BEGIN PERFORM public.board_minutes_import_revision('topical','denied','2026-04-02','Synthetic','', '[]','[]',NULL,repeat('a',64),d,'Agenda'); RAISE EXCEPTION 'Board import allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 FOREACH actor IN ARRAY ARRAY['00000000-0000-0000-0000-000000000003'::uuid,'00000000-0000-0000-0000-000000000004'::uuid,'00000000-0000-0000-0000-000000000005'::uuid] LOOP
 PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated;
 SELECT count(*) INTO n FROM public.board_minutes_import_details; IF n<>0 THEN RAISE EXCEPTION 'Source data leaked'; END IF;
 BEGIN PERFORM public.board_minutes_import_revision('topical','denied','2026-04-02','Synthetic','', '[]','[]',NULL,repeat('a',64),d,'Agenda'); RAISE EXCEPTION 'Member import allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE; END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true); SET LOCAL ROLE anon;
 BEGIN PERFORM * FROM public.board_minutes_import_details; RAISE EXCEPTION 'Anon metadata allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.board_minutes_import_revision('topical','denied','2026-04-02','Synthetic','', '[]','[]',NULL,repeat('a',64),d,'Agenda'); RAISE EXCEPTION 'Anon import allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE; RAISE NOTICE 'PASS import: admin only, board read only, member/extern/inhuur/anon rejected, dedup and historical status preserved';
END $$;
ROLLBACK;