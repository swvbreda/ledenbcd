#!/usr/bin/env bash
# Twee gelijktijdige 'concept -> ingediend' updates op dezelfde declaratie: precies 2 meldingen (1 per goedkeurder).
set -euo pipefail
P=${P:?psql command for isolated fixture}
D=$($P -Atc "UPDATE declaration_push_settings SET enabled=true; INSERT INTO user_roles(user_id,role) SELECT '15adafb2-cb6a-4212-8604-68d27814ba59','admin' WHERE NOT has_role('15adafb2-cb6a-4212-8604-68d27814ba59','admin'); INSERT INTO internal_declarations(status) VALUES ('concept') RETURNING id" | tail -1)
for i in 1 2 3 4 5 6; do $P -c "BEGIN; UPDATE internal_declarations SET status='pending' WHERE id='$D'; SELECT pg_sleep(0.3); COMMIT;" >/dev/null & done; wait
echo "concurrent_submit_notifications=$($P -Atc "SELECT count(*) FROM declaration_notifications WHERE declaration_id='$D'")"
