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
-- Niet-admin ziet niets en kan niet pauzeren.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', (SELECT gen_random_uuid())::text, true);
SELECT pg_temp.ok((SELECT count(*) FROM project_mail_codes) = 0 AND (SELECT count(*) FROM projectmail_settings) = 0, 'niet-admin ziet niets');
DO $$ BEGIN PERFORM projectmail_set_active((SELECT gen_random_uuid()), false); RAISE EXCEPTION 'had moeten weigeren'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%Alleen beheerders%' THEN RAISE; END IF; END $$;
RESET ROLE;
-- Codes blijvend.
DO $$ BEGIN UPDATE project_mail_codes SET reference_code='BCD-ANDERS' WHERE reference_code='BCD-WORLDLINE'; RAISE EXCEPTION 'x'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%blijvend%' THEN RAISE; END IF; END $$;
-- Lease: tweede houder krijgt niets.
SELECT pg_temp.ok(projectmail_acquire('00000000-0000-0000-0000-000000000001',60) AND NOT projectmail_acquire('00000000-0000-0000-0000-000000000002',60), 'lease exclusief');
ROLLBACK;
\echo PASS projectmail_security
