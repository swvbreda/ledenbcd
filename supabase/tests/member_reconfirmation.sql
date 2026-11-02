DO $$ DECLARE v jsonb; failed boolean:=false; BEGIN
 IF (public.member_reconfirmation_answer(repeat('a',64),false)->>'valid')::boolean THEN RAISE EXCEPTION 'Unsent link valid'; END IF;
 BEGIN PERFORM public.member_reconfirmation_claim('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222',repeat('d',64),gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Non-admin allowed'; END IF;
 failed:=false;
 BEGIN PERFORM public.member_reconfirmation_claim('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111',repeat('d',64),gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Unapproved member allowed'; END IF;
 INSERT INTO public.suppressed_emails(email) VALUES('suppressed@example.invalid');
 v:=public.member_reconfirmation_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',repeat('e',64),gen_random_uuid());
 IF v->>'status'<>'suppressed' THEN RAISE EXCEPTION 'Suppression ignored'; END IF;
 IF (SELECT count(*) FROM public.member_notes)<>0 THEN RAISE EXCEPTION 'Note before acceptance'; END IF;
END $$;
-- Concurrent claim is performed by the runner before the following assertions.