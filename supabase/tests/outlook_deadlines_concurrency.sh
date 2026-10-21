#!/bin/bash
set -euo pipefail
# Explicit local socket; never reads managed database environment.
Q=(psql -h /tmp/outlook-deadlines/socket -p 55441 -U fixture -d exact_schema -v ON_ERROR_STOP=1 -At)
"${Q[@]}" -c "select current_setting('port')" | grep -qx 55441
"${Q[@]}" <<'SQL'
INSERT INTO user_roles VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','admin');
SELECT outlook_deadline_configure(true,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO internal_tasks VALUES('dddddddd-dddd-dddd-dddd-dddddddddddd','Concurrent','2026-03-29','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','te_doen',NULL);
SQL
("${Q[@]}" <<'SQL'
BEGIN;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
SET LOCAL ROLE authenticated;
SELECT 'first:'||(outlook_deadline_claim()->>'task_id');
SELECT pg_sleep(2);
COMMIT;
SQL
) > /tmp/outlook-deadlines/first.log &
PID=$!
for i in $(seq 1 40); do if grep -q 'first:' /tmp/outlook-deadlines/first.log; then break; fi; read -t 0.1 -r _ </dev/null || true; done
"${Q[@]}" <<'SQL' > /tmp/outlook-deadlines/second.log
BEGIN;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
SET LOCAL ROLE authenticated;
SELECT 'second_empty:'||(outlook_deadline_claim() IS NULL)::text;
COMMIT;
SQL
wait "$PID"
grep -q first:dddd /tmp/outlook-deadlines/first.log
grep -q second_empty:true /tmp/outlook-deadlines/second.log
"${Q[@]}" -c "SELECT count(*)=1 FROM outlook_deadline_outbox WHERE state='inflight'" | grep -qx t
echo 'PASS: two simultaneous claims, exactly one leased job'
