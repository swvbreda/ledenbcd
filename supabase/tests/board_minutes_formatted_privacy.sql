-- Synthetic isolated database only; never execute against hosted archive.
BEGIN;
DO $$ DECLARE oldid uuid; vid uuid; repeated uuid; changed uuid; mid uuid; actor uuid; d jsonb; BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 oldid:=public.board_minutes_import_revision('topical','topical:formatted-test','2026-04-02','Synthetic original','Synthetic original','[]','[]',NULL,repeat('a',64),'{"status":"historisch-onbevestigd","reviewRequired":true,"reportMissing":false}','Synthetic original');
 SELECT meeting_id INTO mid FROM public.board_minutes_versions WHERE id=oldid;
 INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('board-minutes',mid::text||'/'||repeat('a',64)||'.pdf','{"size":10}');
 PERFORM public.board_minutes_attach(oldid,mid::text||'/'||repeat('a',64)||'.pdf','Original.pdf',repeat('a',64),10);
 d:=jsonb_build_object('status','historisch-onbevestigd','reviewRequired',true,'reportMissing',false,'formatted',true,'reportKind','ai-report','originalSourceSha256',repeat('a',64));
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.board_minutes_import_formatted('topical:absent',oldid,'2026-04-02','Synthetic','Synthetic','[]','[]',NULL,repeat('b',64),d,'Synthetic');RAISE EXCEPTION 'Created absent meeting';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Created absent meeting' THEN RAISE;END IF;END;
 BEGIN PERFORM public.board_minutes_import_formatted('topical:formatted-test',oldid,'2026-04-02','Synthetic','Synthetic','[]','[]',NULL,repeat('b',64),jsonb_set(d,'{originalSourceSha256}',to_jsonb(repeat('c',64))),'Synthetic');RAISE EXCEPTION 'Accepted wrong hash';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Accepted wrong hash' THEN RAISE;END IF;END;
 vid:=public.board_minutes_import_formatted('topical:formatted-test',oldid,'2026-04-02','Synthetic formatted','Synthetic formatted','["Synthetic decision"]','["Synthetic inactive action"]',NULL,repeat('b',64),d,'Synthetic metadata');
 repeated:=public.board_minutes_import_formatted('topical:formatted-test',oldid,'2026-04-02','Synthetic formatted','Synthetic formatted','["Synthetic decision"]','["Synthetic inactive action"]',NULL,repeat('b',64),d,'Synthetic metadata');
 IF repeated IS DISTINCT FROM vid THEN RAISE EXCEPTION 'Repeated import duplicated version';END IF;
 IF (SELECT count(*) FROM public.board_minutes_versions WHERE meeting_id=mid)<>2 OR (SELECT count(*) FROM public.board_minutes_meetings WHERE id=mid)<>1 THEN RAISE EXCEPTION 'Wrong version/meeting count';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.board_minutes_files WHERE version_id=vid AND sha256=repeat('a',64)) OR (SELECT report FROM public.board_minutes_versions WHERE id=oldid)<>'Synthetic original' THEN RAISE EXCEPTION 'Original lost';END IF;
 IF EXISTS(SELECT 1 FROM public.board_minutes_adoptions WHERE version_id IN(oldid,vid)) THEN RAISE EXCEPTION 'Auto adopted';END IF;
 BEGIN PERFORM public.board_minutes_import_formatted('topical:formatted-test',oldid,'2026-04-02','Synthetic formatted','Changed','[]','[]',NULL,repeat('b',64),d,'Synthetic metadata');RAISE EXCEPTION 'Stale append allowed';EXCEPTION WHEN serialization_failure THEN NULL;END;
 changed:=public.board_minutes_import_formatted('topical:formatted-test',vid,'2026-04-02','Synthetic formatted','Synthetic formatted','["Changed decision"]','["Synthetic inactive action"]',NULL,repeat('b',64),d,'Synthetic metadata');
 IF changed=vid THEN RAISE EXCEPTION 'Changed decisions not versioned';END IF;
 IF public.board_minutes_import_formatted('topical:formatted-test',oldid,'2026-04-02','Synthetic formatted','Synthetic formatted','["Synthetic decision"]','["Synthetic inactive action"]',NULL,repeat('b',64),d,'Synthetic metadata') IS DISTINCT FROM vid OR (SELECT id FROM public.board_minutes_versions WHERE meeting_id=mid ORDER BY version DESC LIMIT 1) IS DISTINCT FROM changed THEN RAISE EXCEPTION 'Retry promoted old version';END IF;
 BEGIN PERFORM public.board_minutes_import_formatted('topical:formatted-test',changed,'2026-04-02','Synthetic','Agenda incorrectly as report','[]','[]',NULL,repeat('b',64),d||'{"reportKind":"agenda-only","reportMissing":true}','Synthetic agenda');RAISE EXCEPTION 'Agenda accepted as report';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Agenda accepted as report' THEN RAISE;END IF;END;
 RESET ROLE;
 FOREACH actor IN ARRAY ARRAY['00000000-0000-0000-0000-000000000002'::uuid,'00000000-0000-0000-0000-000000000003'::uuid,'00000000-0000-0000-0000-000000000004'::uuid,'00000000-0000-0000-0000-000000000005'::uuid] LOOP
 PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.board_minutes_import_formatted('topical:formatted-test',changed,'2026-04-02','Synthetic','Synthetic','[]','[]',NULL,repeat('b',64),d,'Synthetic');RAISE EXCEPTION 'Non-admin allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RESET ROLE;END LOOP;
 SET LOCAL ROLE anon;
 BEGIN PERFORM public.board_minutes_import_formatted('topical:formatted-test',changed,'2026-04-02','Synthetic','Synthetic','[]','[]',NULL,repeat('b',64),d,'Synthetic');RAISE EXCEPTION 'Anon allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RESET ROLE;
 RAISE NOTICE 'PASS formatted import: existing-only, source hash, append-only, inherited originals, full-content dedup, stale guard, no adoption, admin-only';
END $$;
ROLLBACK;