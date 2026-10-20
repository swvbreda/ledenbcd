#!/bin/sh
# Concurrent support_wa_reserve_reply with the same client key on the ISOLATED fixture (port 55440 only).
# Expected: exactly one pending message, second call returns existing=true and no phone/body (no second send).
set -e
Q=${Q:-/tmp/supfx/q.sh}
$Q -Atc "select current_setting('port')" | grep -qx 55440 || { echo "not the isolated fixture"; exit 1; }
$Q -q -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','adm@fx'),('aaaaaaaa-0000-0000-0000-00000000000b','m@fx');
INSERT INTO public.user_roles(user_id,role) VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','admin');
INSERT INTO public.members_data(id,member_type,data) VALUES (995001,'member','{}');
INSERT INTO public.member_profiles(user_id,member_id) VALUES ('aaaaaaaa-0000-0000-0000-00000000000b',995001);
INSERT INTO public.whatsapp_member_links(id,user_id,member_id,phone,verified_at) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000b',995001,'31611111111',now()-interval '1 hour');
SELECT public.whatsapp_ingest_verified(jsonb_build_object('id','cc-in','from','31611111111','type','text','text',jsonb_build_object('body','vraag')),'1312061225331302',
  jsonb_build_object('waMessageId','cc-in','waId','31611111111','messageType','text','body','vraag','sentAt',now()));
SQL
T=$($Q -Atc "select thread_id from public.support_messages where wa_message_id='cc-in'")
CALL="select set_config('request.jwt.claims','{\"sub\":\"aaaaaaaa-0000-0000-0000-00000000000a\",\"role\":\"authenticated\"}',true); set local role authenticated;"
( printf "begin; %s select 'S1', public.support_wa_reserve_reply('%s','wa','22222222-2222-2222-2222-222222222222'); select pg_sleep(2); commit;\n" "$CALL" "$T" | $Q -At > /tmp/supfx/s1.out 2>&1 ) &
sleep 0.5
printf "begin; %s select 'S2', public.support_wa_reserve_reply('%s','wa','22222222-2222-2222-2222-222222222222'); commit;\n" "$CALL" "$T" | $Q -At > /tmp/supfx/s2.out 2>&1
wait
grep S1 /tmp/supfx/s1.out; grep -E "S2|ERROR" /tmp/supfx/s2.out
N=$($Q -Atc "select count(*) from public.support_messages where client_key='22222222-2222-2222-2222-222222222222'")
grep -q '"existing": true' /tmp/supfx/s2.out && ! grep -q '"phone"' /tmp/supfx/s2.out && [ "$N" = 1 ] && echo "concurrency: PASS (rows=$N)" || { echo "concurrency: FAIL (rows=$N)"; exit 1; }
