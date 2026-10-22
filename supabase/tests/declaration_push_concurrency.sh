#!/usr/bin/env bash
# Zes gelijktijdige 'concept -> ingediend' updates op dezelfde declaratie: precies 2 meldingen; daarna gelijktijdige claims: elke rij één keer.
set -euo pipefail
P=${P:?psql command for isolated fixture}
D=$($P -Atc "UPDATE declaration_push_settings SET enabled=true, scheduler_armed=false; DELETE FROM declaration_notifications; INSERT INTO internal_declarations(status) VALUES ('concept') RETURNING id" | tail -1)
for i in 1 2 3 4 5 6; do $P -c "BEGIN; UPDATE internal_declarations SET status='pending' WHERE id='$D'; SELECT pg_sleep(0.3); COMMIT;" >/dev/null & done; wait
N=$($P -Atc "SELECT count(*) FROM declaration_notifications WHERE declaration_id='$D'")
[ "$N" = "2" ] || { echo "FAIL: concurrent_submit_notifications=$N (verwacht 2)"; exit 1; }
for i in 1 2 3 4; do $P -Atc "SELECT id FROM declaration_push_claim(10, '$D')" >> /tmp/declfx/claims.$$ & done; wait
C=$(grep -c . /tmp/declfx/claims.$$ || true); U=$(sort -u /tmp/declfx/claims.$$ | grep -c . || true); rm -f /tmp/declfx/claims.$$
[ "$C" = "2" ] && [ "$U" = "2" ] || { echo "FAIL: concurrent_claims=$C unique=$U (verwacht 2/2)"; exit 1; }
echo "CONCURRENCY_OK notifications=2 claims=2"
