-- Rollback-only beveiligingsproef Projectmail (geen blijvende wijzigingen).
\set ON_ERROR_STOP 1
BEGIN;
CREATE FUNCTION pg_temp.ok(b boolean, label text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF b IS NOT TRUE THEN RAISE EXCEPTION 'FAIL %', label; END IF; RETURN 'ok '||label; END $$;
SELECT pg_temp.ok(bool_and(NOT has_table_privilege('anon','public.'||t,'SELECT') AND NOT has_table_privilege('authenticated','public.'||t,'INSERT')
  AND NOT has_table_privilege('authenticated','public.'||t,'UPDATE') AND NOT has_table_privilege('authenticated','public.'||t,'DELETE')), 'grants')
FROM unnest(ARRAY['project_mail_codes','projectmail_settings','projectmail_checkpoint','projectmail_messages','projectmail_reviews','projectmail_task_candidates','projectmail_runs']) t;
SELECT pg_temp.ok(NOT has_table_privilege('authenticated','public.projectmail_checkpoint','SELECT'), 'checkpoint service-only');
SELECT pg_temp.ok(NOT has_column_privilege('authenticated','public.projectmail_settings','lease_token','SELECT'), 'lease verborgen');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated','public.projectmail_acquire(uuid,integer)','EXECUTE') AND NOT has_function_privilege('anon','public.projectmail_set_active(uuid,boolean)','EXECUTE'), 'rpc grants');
SELECT pg_temp.ok(pg_get_functiondef('public.get_member_project_status'::regproc) NOT ILIKE '%projectmail%', 'member RPC zonder projectmail');
SELECT pg_temp.ok((SELECT count(*) = count(DISTINCT lower(reference_code)) AND count(*) = (SELECT count(*) FROM internal_projects) FROM project_mail_codes), 'unieke code per project');
-- Niet-admin: alle leespolicies vereisen has_role admin; mutatie-RPC's controleren admin.
SELECT pg_temp.ok(bool_and(qual ILIKE '%has_role(auth.uid(), ''admin''%'), 'admin-only policies') FROM pg_policies WHERE tablename LIKE 'project%mail%';
SELECT pg_temp.ok(pg_get_functiondef('public.projectmail_set_active'::regproc) ILIKE '%has_role(auth.uid(), ''admin'')%' AND pg_get_functiondef('public.projectmail_resolve_review'::regproc) ILIKE '%has_role(auth.uid(), ''admin'')%', 'rpc admin check');
SELECT pg_temp.ok((SELECT count(*) FROM pg_policies WHERE tablename LIKE 'project%mail%' AND cmd <> 'SELECT') = 0, 'geen schrijfpolicies');
SELECT pg_temp.ok(pg_get_functiondef('public.project_mail_codes_guard'::regproc) ILIKE '%blijvend%', 'code onwijzigbaar');
SELECT pg_temp.ok(pg_get_functiondef('public.projectmail_acquire'::regproc) ILIKE '%lease_until < now()%', 'lease exclusief');
ROLLBACK;
\echo PASS projectmail_security
