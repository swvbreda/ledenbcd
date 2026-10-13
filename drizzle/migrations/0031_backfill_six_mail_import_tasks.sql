-- Eenmalige herkomst-backfill voor exact zes bestaande mail-bronimporttaken.
-- Triggers alleen binnen deze transactie uit (SET LOCAL), zodat updated_at/Planner/geschiedenis ongemoeid blijven.
SET LOCAL session_replication_role = replica;
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.internal_tasks t SET created_origin = 'bronimport', import_ref = v.ref
  FROM (VALUES
    ('b195e118-0c0e-42a8-95f3-622eaf6863b4'::uuid, 'bcd-mail-20261013-import-1-2026-10-13-1120-task-0'),
    ('edad9991-4872-4823-bb51-2a9ceb0fa78e'::uuid, 'bcd-mail-20261013-import-1-2026-10-13-1120-task-1'),
    ('09f729a9-f64d-44f5-83e4-ce1ea4e84e05'::uuid, 'bcd-mail-20261013-import-2-2026-10-13-1446-task-2'),
    ('4c3c156e-f429-4c1c-a6a6-1103aa4a7b37'::uuid, 'bcd-mail-20261013-import-3-2026-10-12-1421-task-3'),
    ('e3bc848f-62f9-4086-bbea-42ec291b065c'::uuid, 'bcd-mail-20261013-import-4-2026-10-12-1221-task-4'),
    ('b25b3ea7-4b9b-487c-a041-427a5ead7992'::uuid, 'bcd-mail-20261013-import-6-2026-10-12-1027-task-5')
  ) AS v(id, ref)
  WHERE t.id = v.id AND t.created_origin IS NULL AND t.import_ref IS NULL
    AND t.source_system IS NULL AND t.source_ref IS NULL AND t.assignee_id IS NULL
    AND t.description LIKE 'Bronimport — aanbevolen interne vervolgactie%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN RAISE EXCEPTION 'Verwacht exact 6 taken, gevonden %', n; END IF;
END $$;
SET LOCAL session_replication_role = origin;