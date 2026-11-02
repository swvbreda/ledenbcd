DO $$ DECLARE c uuid; failed boolean:=false; v jsonb; BEGIN
 IF (SELECT count(*) FROM public.email_send_log WHERE status='pending')<>1 THEN RAISE EXCEPTION 'Concurrent claim duplicated'; END IF;
 SELECT send_claim INTO c FROM public.member_reconfirmation_requests WHERE member_id=10;
 IF c IS NULL THEN RAISE EXCEPTION 'No claim'; END IF;
 BEGIN PERFORM public.member_reconfirmation_finish('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',gen_random_uuid(),'sent','provider-id',200); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Stale claim accepted'; END IF;
 failed:=false;
 BEGIN PERFORM public.member_reconfirmation_finish('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',c,'sent',null,200); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Missing acceptance proof allowed'; END IF;
 PERFORM public.member_reconfirmation_finish('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',c,'sent','provider-id',200);
 IF NOT EXISTS(SELECT 1 FROM public.member_reconfirmation_requests WHERE member_id=10 AND deadline=sent_at+interval '30 days') THEN RAISE EXCEPTION 'Deadline not 30 days from send'; END IF;
 IF (SELECT count(*) FROM public.member_notes)<>1 THEN RAISE EXCEPTION 'Acceptance note missing'; END IF;
 v:=public.member_reconfirmation_answer(repeat('d',64),false);
 IF NOT (v->>'valid')::boolean OR (SELECT count(*) FROM public.member_notes)<>1 THEN RAISE EXCEPTION 'Page open registered confirmation'; END IF;
 PERFORM public.member_reconfirmation_answer(repeat('d',64),true);
 PERFORM public.member_reconfirmation_answer(repeat('d',64),true);
 IF (SELECT count(*) FROM public.member_notes)<>2 THEN RAISE EXCEPTION 'Confirmation replay duplicated note'; END IF;
 IF has_table_privilege('anon','public.member_reconfirmation_requests','SELECT') OR has_table_privilege('authenticated','public.member_reconfirmation_requests','SELECT') THEN RAISE EXCEPTION 'Requests exposed'; END IF;
 IF has_function_privilege('anon','public.member_reconfirmation_claim(uuid,uuid,text,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.member_reconfirmation_finish(uuid,uuid,text,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'RPC exposed'; END IF;
END $$;
-- Unknown outcome remains permanently claimed and cannot rotate its token.
UPDATE public.member_reconfirmation_requests SET send_status='unsent' WHERE member_id=25;
DELETE FROM public.suppressed_emails;
DO $$ DECLARE c uuid:=gen_random_uuid(); v jsonb; BEGIN
 PERFORM public.member_reconfirmation_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',repeat('e',64),c);
 PERFORM public.member_reconfirmation_finish('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',c,'unknown',null,503);
 v:=public.member_reconfirmation_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',repeat('f',64),gen_random_uuid());
 IF (v->>'claimed')::boolean OR NOT EXISTS(SELECT 1 FROM public.member_reconfirmation_requests WHERE member_id=25 AND token_hash=repeat('e',64) AND sent_at IS NULL) THEN RAISE EXCEPTION 'Uncertain send retried or rotated'; END IF;
 IF (SELECT count(*) FROM public.member_notes)<>2 THEN RAISE EXCEPTION 'Unknown created note'; END IF;
END $$;