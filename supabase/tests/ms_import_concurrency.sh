#!/bin/bash
# Twee gelijktijdige agenda-imports van hetzelfde nieuwe item → precies één agenda-item. Alleen tegen geïsoleerde fixture-DB.
set -euo pipefail
SOCK=${SOCK:-/tmp/msimport/pg/sock}
Q=(psql -h "$SOCK" -p 55450 -U fixture -d postgres -v ON_ERROR_STOP=1 -At -q)
"${Q[@]}" -c "select current_setting('port')" | grep -qx 55450
"${Q[@]}" <<'SQL'
DELETE FROM ms_agenda_import_links; DELETE FROM agenda_events; DELETE FROM user_roles;
INSERT INTO user_roles VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','admin');
SELECT ms_import_configure('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{"agenda_calendar_id":"CAL1","agenda_user_id":"12345678-1234-1234-1234-123456789012","agenda_calendar_name":"BCD"}');
SQL
RUN="BEGIN; SELECT ms_import_apply_agenda('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','CAL1','[{\"event_id\":\"PAR\",\"title\":\"Parallel\",\"date\":\"2026-12-01\"}]',false,'2026-01-01','2027-01-01'); SELECT pg_sleep(1); COMMIT;"
"${Q[@]}" -c "$RUN" >/dev/null & P1=$!
"${Q[@]}" -c "$RUN" >/dev/null & P2=$!
wait $P1; wait $P2
"${Q[@]}" -c "SELECT count(*) FROM agenda_events WHERE title='Parallel'" | grep -qx 1
"${Q[@]}" -c "DELETE FROM ms_agenda_import_links; DELETE FROM agenda_events; DELETE FROM user_roles; UPDATE ms_import_settings SET agenda_calendar_id=NULL, agenda_user_id=NULL, agenda_calendar_name=NULL"
echo 'PASS: parallel import → exactly one agenda item'
