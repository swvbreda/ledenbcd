#!/usr/bin/env bash
# Geïsoleerde lokale PostgreSQL (poort 55450). Faalt (exit != 0) bij elke mislukte assertion.
set -euo pipefail
R=$(cd "$(dirname "$0")/../.." && pwd)
U="setpriv --reuid=65534 --regid=65534 --clear-groups"
mkdir -p /tmp/declfx; chmod 777 /tmp/declfx
D=/tmp/declfx/data; rm -rf $D
$U initdb -D $D -U postgres -A trust >/dev/null
$U pg_ctl -D $D -o "-p 55450 -k /tmp/declfx -c listen_addresses=''" -l /tmp/declfx/log -w start >/dev/null
trap '$U pg_ctl -D $D stop -m fast >/dev/null' EXIT
P="psql -h /tmp/declfx -p 55450 -U postgres -X -q -v ON_ERROR_STOP=1"
$P -c "create database fx"; P="$P -d fx"
$P -f "$R/supabase/tests/declaration_push_fixture.sql"
$P -f "$R/supabase/tests/declaration_push_funcs_pre.sql"
for m in 0062_declaration_push_notifications 0063_declaration_push_queue; do $P -f "$R/drizzle/migrations/$m.sql"; done
$P -f "$R/supabase/tests/declaration_push.sql" 2>&1 | tee /tmp/declfx/out.txt | grep -E "OK|FAIL|ERROR" || true
grep -q SQL_ASSERTS_OK /tmp/declfx/out.txt && grep -q CLIENT_ASSERTS_OK /tmp/declfx/out.txt || { echo "FAIL: SQL-tests"; exit 1; }
export P; bash "$R/supabase/tests/declaration_push_concurrency.sh"
