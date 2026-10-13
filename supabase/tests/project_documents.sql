-- Projectdocumenten + planning/opmerkingen. Volledig teruggedraaid via eindexceptie; geen echte bestanden.
DO $$
DECLARE a1 uuid; mem uuid; p uuid; d record; c int; res text := ''; h text := repeat('a',64); path text; v text;
BEGIN
  SELECT user_id INTO a1 FROM user_roles WHERE role='admin' ORDER BY user_id LIMIT 1;
  SELECT user_id INTO mem FROM user_roles r WHERE role='user' AND NOT has_role(r.user_id,'admin') LIMIT 1;
  INSERT INTO internal_projects(title) VALUES ('rollbacktest docs') RETURNING id INTO p;
  path := p::text || '/' || h || '.pdf';

  PERFORM set_config('request.jwt.claims', json_build_object('sub',a1,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE internal_projects SET planning='Gesprek plannen', planning_date='2026-11-01', remarks='opm' WHERE id=p;
  SELECT count(*) INTO c FROM internal_project_events WHERE project_id=p AND summary LIKE '%planning bijgewerkt%opmerkingen bijgewerkt%';
  res := res || ' planning_event=' || c;
  -- metadata zonder bestand: geweigerd
  BEGIN INSERT INTO internal_project_documents(project_id,title,doc_type,original_filename,size_bytes,mime_type,sha256,object_path)
    VALUES (p,'Brief','brief','b.pdf',10,'application/pdf',h,path); res := res||' no_file=ALLOWED';
  EXCEPTION WHEN raise_exception THEN res := res||' no_file=rejected'; END;
  -- ongeldig pad/extensie in storage geweigerd
  BEGIN INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('project-documents', p::text||'/x.exe', a1); res := res||' bad_ext=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res||' bad_ext=denied'; END;
  BEGIN INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('project-documents', gen_random_uuid()::text||'/'||h||'.pdf', a1); res := res||' bad_project=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res||' bad_project=denied'; END;
  INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('project-documents', path, a1);
  INSERT INTO internal_project_documents(project_id,title,doc_type,original_filename,size_bytes,mime_type,sha256,object_path,uploaded_by,created_at)
    VALUES (p,'Brief','brief','b.pdf',10,'application/pdf',h,path,mem,'2000-01-01') RETURNING * INTO d;
  res := res || ' uploader=' || CASE WHEN d.uploaded_by=a1 AND d.created_at>'2001-01-01' THEN 'forced' ELSE 'SPOOFED' END;
  BEGIN INSERT INTO internal_project_documents(project_id,title,doc_type,original_filename,size_bytes,mime_type,sha256,object_path)
    VALUES (p,'Dubbel','brief','b.pdf',10,'application/pdf',h,path); res := res||' dup=ALLOWED';
  EXCEPTION WHEN unique_violation THEN res := res||' dup=rejected'; END;
  BEGIN UPDATE storage.objects SET name=name WHERE bucket_id='project-documents' AND name=path; GET DIAGNOSTICS c = ROW_COUNT; res := res||' overwrite_rows='||c;
  EXCEPTION WHEN insufficient_privilege THEN res := res||' overwrite=denied'; END;
  BEGIN UPDATE internal_project_documents SET title='x' WHERE id=d.id; res := res||' meta_edit=ALLOWED';
  EXCEPTION WHEN raise_exception THEN res := res||' meta_edit=rejected'; END;
  UPDATE internal_project_documents SET archived_at='2000-01-01' WHERE id=d.id;
  SELECT CASE WHEN archived_by=a1 AND archived_at>'2001-01-01' THEN 'ok' ELSE 'FAIL' END INTO v FROM internal_project_documents WHERE id=d.id;
  res := res||' archive='||v;
  BEGIN DELETE FROM internal_project_documents WHERE id=d.id; res := res||' delete=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res||' delete=denied'; END;
  SELECT count(*) INTO c FROM internal_project_events WHERE project_id=p AND event_type LIKE 'document_%'; res := res||' doc_events='||c;

  -- niet-admin lid
  PERFORM set_config('request.jwt.claims', json_build_object('sub',mem,'role','authenticated')::text, true);
  SELECT count(*) INTO c FROM internal_project_documents; res := res||' member_meta='||c;
  SELECT count(*) INTO c FROM storage.objects WHERE bucket_id='project-documents'; res := res||' member_files='||c;
  BEGIN INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('project-documents', p::text||'/'||repeat('b',64)||'.pdf', mem); res := res||' member_upload=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res||' member_upload=denied'; END;
  UPDATE internal_projects SET planning='hack' WHERE id=p; GET DIAGNOSTICS c = ROW_COUNT; res := res||' member_planning_rows='||c;

  -- anoniem
  RESET ROLE; PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true); SET LOCAL ROLE anon;
  BEGIN SELECT count(*) INTO c FROM internal_project_documents; res := res||' anon_meta='||c;
  EXCEPTION WHEN insufficient_privilege THEN res := res||' anon_meta=denied'; END;
  SELECT count(*) INTO c FROM storage.objects WHERE bucket_id='project-documents'; res := res||' anon_files='||c;
  BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES ('project-documents', p::text||'/'||repeat('c',64)||'.pdf'); res := res||' anon_upload=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN res := res||' anon_upload=denied'; END;
  RESET ROLE;
  RAISE EXCEPTION 'ROLLBACK_RESULT:%', res;
END $$;
