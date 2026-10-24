#!/usr/bin/env bash
set -euo pipefail
R=$(cd "$(dirname "$0")/../.." && pwd)
D=$(mktemp -d /tmp/bcd-contact-fx-XXXXXX)
U="setpriv --reuid=1000 --regid=1000 --clear-groups"
chmod 777 "$D"
$U initdb -D "$D/data" -U postgres -A trust >/dev/null
$U pg_ctl -D "$D/data" -o "-p 55460 -k $D -c listen_addresses=''" -l "$D/log" -w start >/dev/null
trap '$U pg_ctl -D "$D/data" stop -m fast >/dev/null' EXIT
P=(psql -h "$D" -p 55460 -U postgres -X -q -v ON_ERROR_STOP=1)
"${P[@]}" -f "$R/supabase/tests/contact_removal_fixture.sql"
"${P[@]}" -f "$R/drizzle/migrations/0069_contact_removal_access_guard.sql"
"${P[@]}" -f "$R/supabase/tests/contact_removal.sql"
