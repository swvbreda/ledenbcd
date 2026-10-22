set -euo pipefail
U="setpriv --reuid=65534 --regid=65534 --clear-groups"
D=/tmp/declfx/data; rm -rf $D
$U initdb -D $D -U postgres -A trust >/dev/null
$U pg_ctl -D $D -o "-p 55450 -k /tmp/declfx -c listen_addresses=''" -l /tmp/declfx/log -w start >/dev/null
trap '$U pg_ctl -D $D stop -m fast >/dev/null' EXIT
P="psql -h /tmp/declfx -p 55450 -U postgres -X -q -v ON_ERROR_STOP=1"
$P -c "create database fx"; P="$P -d fx"
$P -f /dev-server/supabase/tests/declaration_push_fixture.sql
$P -f /tmp/declfx/funcs_pre.sql
$P -f /dev-server/drizzle/migrations/0062_declaration_push_notifications.sql
$P -f /dev-server/supabase/tests/declaration_push.sql 2>&1 | grep -E "RESULT|sees|=denied|=allowed"
export P; bash /dev-server/supabase/tests/declaration_push_concurrency.sh
