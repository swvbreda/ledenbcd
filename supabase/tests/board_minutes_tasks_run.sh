#!/usr/bin/env bash
set -euo pipefail
ROOT=$(pwd)
D=$(mktemp -d /tmp/board-task-pg-XXXX); chmod 777 "$D"
U='setpriv --reuid=1000 --regid=1000 --clear-groups'
$U initdb -D "$D/data" -U postgres -A trust >/dev/null
$U pg_ctl -D "$D/data" -o "-p 55469 -k $D -c listen_addresses=''" -l "$D/log" -w start >/dev/null
trap '$U pg_ctl -D "$D/data" stop -m fast >/dev/null' EXIT
P=(psql -h "$D" -p 55469 -U postgres -X -q -v ON_ERROR_STOP=1)
"${P[@]}" -f "$ROOT/supabase/tests/board_minutes_tasks_setup.sql"
for n in 0079 0080 0081 0082 0084; do "${P[@]}" -f $(ls "$ROOT"/drizzle/migrations/${n}_*.sql); done
"${P[@]}" -f "$ROOT/drizzle/migrations/0032_server_owned_work_timestamps.sql"
sed -n '11,27p' "$ROOT/drizzle/migrations/0027_project_workspace.sql" | "${P[@]}"
"${P[@]}" <<'SQL'
CREATE TRIGGER task_validate BEFORE INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.internal_work_validate();
CREATE TRIGGER task_notify AFTER INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.internal_task_assignment_notify();
CREATE TRIGGER task_outlook AFTER INSERT OR UPDATE ON public.internal_tasks FOR EACH ROW EXECUTE FUNCTION public.outlook_deadline_task_changed();
SQL
"${P[@]}" -f "$ROOT/supabase/tests/board_minutes_tasks.sql"