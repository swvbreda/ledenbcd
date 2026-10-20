/** Run ONLY against the isolated fixture database, never production. */
import postgres from "postgres";
const sql = postgres({ host: "/tmp/whatsapp-release/pg", port: 55439, username: "lovable", database: "postgres", max: 12 });
try {
  const owners = await sql`select current_user`;
  if (owners[0]?.current_user !== "lovable") throw new Error("Isolated database required");
  await sql`alter table public.member_announcements disable trigger notify_members_on_published_announcement`;
  await sql`insert into public.whatsapp_announcement_publishers(phone,enabled,authorized_by) values('+31999999999',true,'00000000-0000-0000-0000-000000000001') on conflict(phone) do nothing`;
  const message = { id: "isolated-concurrent", from: "31999999999", type: "text", context: { forwarded: true }, text: { body: "Concurrent\nhttps://example.test" } };
  const parsed = { waMessageId: message.id, waId: message.from, messageType: "text", body: message.text.body };
  await Promise.all(Array.from({ length: 12 }, () => sql`select public.whatsapp_ingest_verified(${sql.json(message)},'1312061225331302',${sql.json(parsed)})`));
  const rows = await sql`select (select count(*) from public.whatsapp_announcement_decisions where wa_message_id='isolated-concurrent') as decisions, (select count(*) from public.member_announcements where id in(select announcement_id from public.whatsapp_announcement_decisions where wa_message_id='isolated-concurrent')) as announcements`;
  if (Number(rows[0]?.decisions) !== 1 || Number(rows[0]?.announcements) !== 1) throw new Error("Concurrent dedup failed");
  console.log("12 concurrent verified ingests: exactly 1 decision and 1 announcement, isolated database only");
} finally { await sql.end(); }