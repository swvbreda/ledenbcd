-- Rollback-test voor ms_import RPC's in geïsoleerde fixture-DB.
\set ON_ERROR_STOP 1
BEGIN;
CREATE FUNCTION pg_temp.ok(b boolean) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF b IS NOT TRUE THEN RAISE EXCEPTION 'assertion failed'; END IF; RETURN 'ok'; END $$;
INSERT INTO user_roles VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','admin'), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','user');
INSERT INTO internal_projects VALUES ('11111111-1111-1111-1111-111111111111', NULL);
INSERT INTO planner_project_links VALUES ('11111111-1111-1111-1111-111111111111','ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6','bucketA');
INSERT INTO planner_user_map VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ENTRA-1');
INSERT INTO agenda_events (title, event_type, event_date, outlook_event_id) VALUES ('Bestaand app-evenement','evenement','2026-11-01','EV-APP');

-- 1. Zonder bevestigde agenda: weigering.
DO $$ BEGIN PERFORM ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL1','[]',true,'2026-01-01','2027-01-01'); RAISE EXCEPTION 'had moeten weigeren';
EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%niet bevestigd%' THEN RAISE; END IF; END $$;
-- 2. Niet-admin kan niet configureren; release_gate niet instelbaar.
DO $$ BEGIN PERFORM ms_import_configure('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','{"enabled":true}'); RAISE EXCEPTION 'x';
EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%Alleen beheerders%' THEN RAISE; END IF; END $$;
DO $$ BEGIN PERFORM ms_import_configure('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{"release_gate":true}'); RAISE EXCEPTION 'x';
EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%Niet-toegestane%' THEN RAISE; END IF; END $$;
SELECT ms_import_configure('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{"agenda_calendar_id":"CAL1","agenda_user_id":"12345678-1234-1234-1234-123456789012","agenda_calendar_name":"BCD"}');
-- 3. Andere kalender: weigering.
DO $$ BEGIN PERFORM ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL-PRIVE','[]',true,'2026-01-01','2027-01-01'); RAISE EXCEPTION 'x';
EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%niet bevestigd%' THEN RAISE; END IF; END $$;
-- 4. Nieuw, dubbel in één batch, conflict met bestaand app-item.
SELECT ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL1',
 '[{"event_id":"E1","title":"Overleg","date":"2026-11-10","start_time":"10:00","end_time":"11:00","teams_url":"https://teams.microsoft.com/l/x"},
   {"event_id":"E1","title":"Overleg","date":"2026-11-10","start_time":"10:00","end_time":"11:00"},
   {"event_id":"EV-APP","title":"Echo","date":"2026-11-01"}]', true, '2026-01-01','2027-01-01');
SELECT pg_temp.ok( (SELECT count(*) FROM agenda_events WHERE event_type='vergadering' AND NOT is_published) = 1);
SELECT pg_temp.ok( (SELECT count(*) FROM ms_import_conflicts WHERE reason='bestaand_app_item') = 1);
-- 5. Verplaatsen → zelfde item bijgewerkt; annulering → alleen gekoppeld item.
SELECT ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL1','[{"event_id":"E1","title":"Overleg (verzet)","date":"2026-11-12","start_time":"14:00","end_time":"15:00"}]',false,'2026-01-01','2027-01-01');
SELECT pg_temp.ok( (SELECT event_date FROM agenda_events WHERE event_type='vergadering') = '2026-11-12');
-- 6. Onvolledig (complete=false) met leeg resultaat → geen 'missing'.
SELECT ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL1','[]',false,'2026-01-01','2027-01-01');
SELECT pg_temp.ok( (SELECT remote_state FROM ms_agenda_import_links) = 'present');
SELECT ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL1','[{"event_id":"E1","title":"Overleg (verzet)","date":"2026-11-12","cancelled":true}]',true,'2026-01-01','2027-01-01');
SELECT pg_temp.ok( (SELECT count(*) FROM agenda_events WHERE cancelled_at IS NOT NULL) = 1 AND (SELECT cancelled_at FROM agenda_events WHERE outlook_event_id='EV-APP') IS NULL);

-- 7. Planner: niet-gekoppelde bucket geweigerd.
DO $$ BEGIN PERFORM ms_import_apply_planner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bucketX','[]',true); RAISE EXCEPTION 'x';
EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%niet expliciet gekoppeld%' THEN RAISE; END IF; END $$;
-- 8. Import met bekende/onbekende/meerdere personen; geen meldingen.
SELECT ms_import_apply_planner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bucketA',
 '[{"id":"P1","title":"Taak 1","due":"2026-11-20","percent":0,"assignees":["entra-1"],"hash":"h1"},
   {"id":"P2","title":"Taak 2","percent":50,"assignees":["onbekend"],"hash":"h2"},
   {"id":"P3","title":"Taak 3","percent":0,"assignees":["entra-1","x"],"hash":"h3"}]', true);
SELECT pg_temp.ok( (SELECT assignee_id FROM internal_tasks WHERE title='Taak 1') = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND (SELECT assignee_id FROM internal_tasks WHERE title='Taak 2') IS NULL AND (SELECT assignee_id FROM internal_tasks WHERE title='Taak 3') IS NULL
  AND (SELECT count(*) FROM ms_planner_import_links WHERE warning IS NOT NULL) = 2);
-- 9. Afronden + ontbreken na volledige lezing → lokaal behouden, bronstatus missing.
SELECT ms_import_apply_planner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bucketA','[{"id":"P1","title":"Taak 1","due":"2026-11-21","percent":100,"assignees":["entra-1"],"hash":"h1b"}]', true);
SELECT pg_temp.ok( (SELECT status FROM internal_tasks WHERE title='Taak 1') = 'afgerond' AND (SELECT deadline FROM internal_tasks WHERE title='Taak 1') = '2026-11-21'
  AND (SELECT count(*) FROM ms_planner_import_links WHERE source_state='missing') = 2 AND (SELECT count(*) FROM internal_tasks) = 3
  AND (SELECT status FROM internal_tasks WHERE title='Taak 2') = 'bezig');
-- 10. Twee-richtingskoppeling → conflict, geen import. Leesmodus uit → weigering.
INSERT INTO planner_task_links VALUES (gen_random_uuid(), 'P9');
SELECT ms_import_apply_planner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bucketA','[{"id":"P9","title":"Oud","percent":0,"hash":"z"}]', false);
SELECT pg_temp.ok( (SELECT count(*) FROM internal_tasks WHERE title='Oud') = 0);
SELECT pg_temp.ok( (SELECT count(*) FROM task_notifications) = 0);
-- 11. Grants: authenticated mag RPC's niet uitvoeren.
SELECT pg_temp.ok( NOT has_function_privilege('authenticated','ms_import_apply_planner(uuid,text,jsonb,boolean)','EXECUTE')
  AND NOT has_function_privilege('anon','ms_import_configure(uuid,jsonb)','EXECUTE')
  AND NOT has_table_privilege('authenticated','ms_import_settings','UPDATE'));
-- 12. Eigen importannulering wordt hersteld als Outlook het item weer actief toont.
SELECT ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL1','[{"event_id":"E1","title":"Overleg (terug)","date":"2026-11-12"}]',false,'2026-01-01','2027-01-01');
SELECT pg_temp.ok( (SELECT cancelled_at FROM agenda_events WHERE event_type='vergadering') IS NULL
  AND (SELECT NOT cancelled_by_import FROM ms_agenda_import_links WHERE event_id='E1'));
-- 13. Lokale beheerdersannulering blijft staan, ook als Outlook actief is.
UPDATE agenda_events SET cancelled_at = now(), cancel_reason = 'Bestuur besloot' WHERE event_type='vergadering';
SELECT ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL1','[{"event_id":"E1","title":"Overleg (terug)","date":"2026-11-12"}]',false,'2026-01-01','2027-01-01');
SELECT pg_temp.ok( (SELECT cancelled_at FROM agenda_events WHERE event_type='vergadering') IS NOT NULL);
-- 14. Gelijke hash, nieuw bevestigde accountkoppeling → eigenaar alsnog bijgewerkt; lokale wijziging teruggezet naar Microsoft.
INSERT INTO user_roles VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc','admin');
INSERT INTO planner_user_map VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc','onbekend');
UPDATE internal_tasks SET title = 'Lokaal hernoemd' WHERE title='Taak 2';
SELECT ms_import_apply_planner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bucketA','[{"id":"P2","title":"Taak 2","percent":50,"assignees":["onbekend"],"hash":"h2"}]', false);
SELECT pg_temp.ok( (SELECT assignee_id FROM internal_tasks t JOIN ms_planner_import_links l ON l.task_id=t.id WHERE l.planner_task_id='P2') = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  AND (SELECT title FROM internal_tasks t JOIN ms_planner_import_links l ON l.task_id=t.id WHERE l.planner_task_id='P2') = 'Taak 2'
  AND (SELECT warning FROM ms_planner_import_links WHERE planner_task_id='P2') IS NULL);
-- 15. Topical-taak buiten importkoppeling blijft onaangeroerd.
INSERT INTO internal_tasks (title, source_system, created_by) VALUES ('Topical blijft', 'topical', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
SELECT pg_temp.ok( (SELECT count(*) FROM internal_tasks WHERE title='Topical blijft') = 1);
-- 16. Rollen op alle zes importtabellen.
SELECT pg_temp.ok(bool_and(NOT has_table_privilege('anon', 'public.'||t, 'SELECT') AND NOT has_table_privilege('anon', 'public.'||t, 'INSERT')
  AND has_table_privilege('authenticated', 'public.'||t, 'SELECT') AND NOT has_table_privilege('authenticated', 'public.'||t, 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.'||t, 'UPDATE') AND NOT has_table_privilege('authenticated', 'public.'||t, 'DELETE')
  AND has_table_privilege('service_role', 'public.'||t, 'INSERT') AND has_table_privilege('service_role', 'public.'||t, 'UPDATE')))
FROM unnest(ARRAY['ms_import_settings','ms_agenda_import_links','ms_planner_import_links','ms_planner_unprocessed','ms_import_conflicts','ms_import_runs']) t;
-- 17. Admin-RLS: niet-admin ziet niets, admin wel.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
SELECT pg_temp.ok( (SELECT count(*) FROM ms_import_settings) = 0 AND (SELECT count(*) FROM ms_planner_import_links) = 0);
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
SELECT pg_temp.ok( (SELECT count(*) FROM ms_import_settings) = 1 AND (SELECT count(*) FROM ms_planner_import_links) > 0);
RESET ROLE;
ROLLBACK;
\echo PASS ms_import
