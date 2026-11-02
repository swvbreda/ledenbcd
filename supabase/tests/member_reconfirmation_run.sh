#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DIR=$(mktemp -d /tmp/bcd-reconfirmation-XXXXXX)
U="setpriv --reuid=1000 --regid=1000 --clear-groups"
chmod 777 "$DIR"
$U initdb -D "$DIR/data" -U postgres -A trust >/dev/null
$U pg_ctl -D "$DIR/data" -o "-p 55466 -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
trap '$U pg_ctl -D "$DIR/data" stop -m fast >/dev/null' EXIT
P=(psql -h "$DIR" -p 55466 -U postgres -X -q -v ON_ERROR_STOP=1)
"${P[@]}" -f "$ROOT/supabase/tests/member_reconfirmation_fixture.sql"
"${P[@]}" -f "$ROOT/drizzle/migrations/0075_member_reconfirmation_individual_send.sql"
"${P[@]}" -f "$ROOT/supabase/tests/member_reconfirmation.sql"
for i in $(seq 1 8); do
  "${P[@]}" -c "select public.member_reconfirmation_claim('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111',repeat('d',64),gen_random_uuid());" >"$DIR/claim-$i" &
done
wait
"${P[@]}" -f "$ROOT/supabase/tests/member_reconfirmation_after_claim.sql"
echo 'Isolated reconfirmation database assertions and eight concurrent claims passed; no real mail transport.'