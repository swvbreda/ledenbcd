-- Existing identities, real helpers and actual authenticated/anon SQL roles.
-- Synthetic records exist only inside this rolled-back transaction; no auth/session mint.
BEGIN;
DO $$
DECLARE
 admin_id uuid; board_id uuid; member_id uuid; extern_id uuid; inhuur_id uuid;
 actor uuid; org_id uuid; contact_id uuid; affected integer; n integer;
BEGIN
 SELECT user_id INTO admin_id FROM public.user_roles WHERE role='admin' LIMIT 1;
 SELECT mp.user_id INTO board_id FROM public.member_profiles mp
 WHERE public.is_board_member(mp.user_id) AND NOT public.has_role(mp.user_id,'admin') LIMIT 1;
 SELECT mp.user_id INTO member_id FROM public.member_profiles mp
 WHERE NOT public.is_board_member(mp.user_id) AND NOT public.has_role(mp.user_id,'admin')
 AND NOT public.has_role(mp.user_id,'extern') LIMIT 1;
 SELECT user_id INTO extern_id FROM public.user_roles WHERE role='extern' AND NOT public.has_role(user_id,'admin') AND NOT public.is_board_member(user_id) LIMIT 1;
 SELECT ur.user_id INTO inhuur_id FROM public.user_roles ur WHERE ur.role='inhuur'
 AND NOT public.has_role(ur.user_id,'admin') AND NOT public.is_board_member(ur.user_id)
 AND NOT EXISTS(SELECT 1 FROM public.member_profiles mp WHERE mp.user_id=ur.user_id) LIMIT 1;
 IF admin_id IS NULL OR board_id IS NULL OR member_id IS NULL OR extern_id IS NULL OR inhuur_id IS NULL THEN
 RAISE EXCEPTION 'Missing required real role fixture'; END IF;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.address_book_organizations(name) VALUES ('SYNTHETISCH ROLLBACK CONTACTENTEST') RETURNING id INTO org_id;
 INSERT INTO public.address_book_contacts(organization_id,name,position,email) VALUES
 (org_id,'SYNTHETISCH Persoon A','SYNTHETISCH Beleidsadviseur','synthetic-a@example.invalid'),
 (org_id,'SYNTHETISCH Persoon B','SYNTHETISCH Secretaris','synthetic-b@example.invalid');
 SELECT count(*) INTO n FROM public.address_book_contacts WHERE organization_id=org_id;
 IF n<>2 THEN RAISE EXCEPTION 'Admin insert/read failed'; END IF;
 UPDATE public.address_book_organizations SET abbreviation='SYNTH' WHERE id=org_id;
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Admin update failed'; END IF;
 INSERT INTO public.address_book_contacts(organization_id,name) VALUES(org_id,'SYNTHETISCH Delete test') RETURNING id INTO contact_id;
 DELETE FROM public.address_book_contacts WHERE id=contact_id;
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Admin delete failed'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',board_id::text,true);
 SET LOCAL ROLE authenticated;
 SELECT count(*) INTO n FROM public.address_book_contacts WHERE organization_id=org_id;
 IF n<>2 THEN RAISE EXCEPTION 'Board read failed'; END IF;
 INSERT INTO public.address_book_contacts(organization_id,name) VALUES(org_id,'SYNTHETISCH Board person') RETURNING id INTO contact_id;
 UPDATE public.address_book_contacts SET position='SYNTHETISCH Updated' WHERE id=contact_id;
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Board update failed'; END IF;
 DELETE FROM public.address_book_contacts WHERE id=contact_id;
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Board delete failed'; END IF;
 INSERT INTO public.address_book_organizations(name) VALUES('SYNTHETISCH Board org') RETURNING id INTO contact_id;
 UPDATE public.address_book_organizations SET abbreviation='BOARD' WHERE id=contact_id;
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Board organization update failed'; END IF;
 DELETE FROM public.address_book_organizations WHERE id=contact_id;
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Board organization delete failed'; END IF;
 RESET ROLE;
 FOREACH actor IN ARRAY ARRAY[member_id,extern_id,inhuur_id] LOOP
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.address_book_organizations WHERE id=org_id;
  IF n<>0 THEN RAISE EXCEPTION 'Denied organization read leaked'; END IF;
  SELECT count(*) INTO n FROM public.address_book_contacts WHERE organization_id=org_id;
  IF n<>0 THEN RAISE EXCEPTION 'Denied contact read leaked'; END IF;
  BEGIN
   INSERT INTO public.address_book_organizations(name) VALUES('SYNTHETISCH denied');
   RAISE EXCEPTION 'Denied organization insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
   INSERT INTO public.address_book_contacts(organization_id,name) VALUES(org_id,'SYNTHETISCH denied');
   RAISE EXCEPTION 'Denied contact insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.address_book_organizations SET name='SYNTHETISCH denied' WHERE id=org_id;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'Denied organization update allowed'; END IF;
  UPDATE public.address_book_contacts SET name='SYNTHETISCH denied' WHERE organization_id=org_id;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'Denied contact update allowed'; END IF;
  DELETE FROM public.address_book_contacts WHERE organization_id=org_id;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'Denied contact delete allowed'; END IF;
  DELETE FROM public.address_book_organizations WHERE id=org_id;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'Denied organization delete allowed'; END IF;
  RESET ROLE;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 SET LOCAL ROLE anon;
 BEGIN PERFORM * FROM public.address_book_organizations; RAISE EXCEPTION 'Anonymous read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.address_book_organizations(name) VALUES('SYNTHETISCH anon'); RAISE EXCEPTION 'Anonymous write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.address_book_contacts; RAISE EXCEPTION 'Anonymous contact read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.address_book_contacts(organization_id,name) VALUES(org_id,'SYNTHETISCH anon'); RAISE EXCEPTION 'Anonymous contact write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 SET LOCAL ROLE authenticated;
 DELETE FROM public.address_book_organizations WHERE id=org_id;
 SELECT count(*) INTO n FROM public.address_book_contacts WHERE organization_id=org_id;
 IF n<>0 THEN RAISE EXCEPTION 'Address-book-only cascade failed'; END IF;
 RESET ROLE;
 RAISE NOTICE 'PASS: real admin/board CRUD, member/extern/unlinked-inhuur denied, anonymous denied, two contacts/cascade; rollback follows';
END $$;
ROLLBACK;
SELECT (SELECT count(*) FROM public.address_book_organizations) AS organizations_after_rollback, (SELECT count(*) FROM public.address_book_contacts) AS contacts_after_rollback;
