-- Leesrechtentest foutdetails declaraties. Draait alles terug via RAISE EXCEPTION.
-- Verwacht: lid_leest=0 lid_schrijft=geweigerd admin_leest>=1 penningmeester_leest>=1 declaraties_met_foutveld=0
DO $$
DECLARE d uuid; member_uid uuid; admin_uid uuid; tres_uid uuid; n_member int; n_admin int; n_tres int; n_decl_err int; ins_ok text;
BEGIN
  SELECT id INTO d FROM public.internal_declarations LIMIT 1;
  SELECT u.id INTO member_uid FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin') AND NOT public.is_treasurer(u.id) LIMIT 1;
  SELECT user_id INTO admin_uid FROM public.user_roles WHERE role='admin' LIMIT 1;
  SELECT u.id INTO tres_uid FROM auth.users u WHERE public.is_treasurer(u.id) LIMIT 1;
  INSERT INTO public.internal_declaration_sync_attempts(declaration_id, status, sanitized_error) VALUES (d, 'error', 'TEST-ROLLBACK');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', member_uid, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n_member FROM public.internal_declaration_sync_attempts;
  BEGIN
    INSERT INTO public.internal_declaration_sync_attempts(declaration_id, status) VALUES (d, 'sent');
    ins_ok := 'TOEGESTAAN (FOUT)';
  EXCEPTION WHEN others THEN ins_ok := 'geweigerd';
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_uid, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n_admin FROM public.internal_declaration_sync_attempts;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', tres_uid, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n_tres FROM public.internal_declaration_sync_attempts;
  RESET ROLE;

  SELECT count(*) INTO n_decl_err FROM public.internal_declarations WHERE informer_error IS NOT NULL;
  RAISE EXCEPTION 'TESTRESULTAAT (teruggedraaid): lid_leest=% lid_schrijft=% admin_leest=% penningmeester_leest=% declaraties_met_foutveld=%', n_member, ins_ok, n_admin, n_tres, n_decl_err;
END $$;
