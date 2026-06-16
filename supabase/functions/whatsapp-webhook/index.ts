// WhatsApp Cloud API webhook receiver
// - GET: verification handshake (Meta calls this once when you save the webhook URL)
// - POST: incoming messages and delivery status updates
//
// Public endpoint (no JWT) — we verify Meta's X-Hub-Signature-256 with WHATSAPP_APP_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, "");
  if (digits.length < 8) return null;
  return digits.slice(-9);
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!APP_SECRET) {
    console.warn("WHATSAPP_APP_SECRET not set — skipping signature check");
    return true;
  }
  const sigHeader = req.headers.get("x-hub-signature-256");
  if (!sigHeader?.startsWith("sha256=")) return false;
  const expected = sigHeader.slice(7);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === expected;
}

async function findMemberIdForPhone(supabase: ReturnType<typeof createClient>, phone: string): Promise<number | null> {
  const norm = normalizePhone(phone);
  if (!norm) return null;

  // 1) whatsapp_participants
  const { data: wp } = await supabase
    .from("whatsapp_participants")
    .select("member_id, phone")
    .not("member_id", "is", null);
  for (const row of (wp ?? []) as Array<{ member_id: number; phone: string | null }>) {
    if (normalizePhone(row.phone) === norm) return row.member_id;
  }

  // 2) members_data + member_edits (top-level telefoon + contacten[].telefoon)
  const { data: members } = await supabase
    .from("members_data")
    .select("id, data");
  const { data: edits } = await supabase
    .from("member_edits")
    .select("member_id, data");
  const editsById = new Map<number, any>();
  for (const e of (edits ?? []) as Array<{ member_id: number; data: any }>) editsById.set(e.member_id, e.data);

  for (const m of (members ?? []) as Array<{ id: number; data: any }>) {
    const merged = { ...(m.data ?? {}), ...(editsById.get(m.id) ?? {}) };
    if (normalizePhone(merged?.telefoon) === norm) return m.id;
    const contacten = Array.isArray(merged?.contacten) ? merged.contacten : [];
    for (const c of contacten) {
      if (normalizePhone(c?.telefoon) === norm) return m.id;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // GET = Meta verification handshake
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const valid = await verifySignature(req, rawBody);
  if (!valid) {
    console.warn("Invalid X-Hub-Signature-256");
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const contacts: Array<{ wa_id: string; profile?: { name?: string } }> = value.contacts ?? [];
        const messages: any[] = value.messages ?? [];
        const statuses: any[] = value.statuses ?? [];

        // --- Inbound messages ---
        for (const msg of messages) {
          const fromPhone: string = msg.from; // E.164 without "+"
          const waId = msg.id as string;
          const ts = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString();
          const text = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? null;
          const mediaType = msg.type ?? null;
          const profileName = contacts.find((c) => c.wa_id === fromPhone)?.profile?.name ?? null;

          const memberId = await findMemberIdForPhone(supabase, fromPhone);

          await supabase.from("whatsapp_messages").upsert(
            {
              wa_message_id: waId,
              member_id: memberId,
              phone: `+${fromPhone}`,
              direction: "inbound",
              body: text,
              media_type: mediaType,
              status: "received",
              timestamp: ts,
            },
            { onConflict: "wa_message_id" },
          );

          // Upsert conversation
          const { data: existing } = await supabase
            .from("whatsapp_conversations")
            .select("id, unread_count")
            .eq("phone", `+${fromPhone}`)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("whatsapp_conversations")
              .update({
                member_id: memberId ?? undefined,
                display_name: profileName ?? undefined,
                last_inbound_at: ts,
                last_message_at: ts,
                last_message_preview: text?.slice(0, 140) ?? `[${mediaType ?? "bericht"}]`,
                unread_count: (existing.unread_count ?? 0) + 1,
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("whatsapp_conversations").insert({
              phone: `+${fromPhone}`,
              member_id: memberId,
              display_name: profileName,
              last_inbound_at: ts,
              last_message_at: ts,
              last_message_preview: text?.slice(0, 140) ?? `[${mediaType ?? "bericht"}]`,
              unread_count: 1,
            });
          }
        }

        // --- Delivery / read statuses for outbound messages ---
        for (const st of statuses) {
          const waId = st.id as string;
          const status = st.status as string; // sent | delivered | read | failed
          const errorMsg = st.errors?.[0]?.title ?? null;
          await supabase
            .from("whatsapp_messages")
            .update({
              status,
              error: errorMsg,
            })
            .eq("wa_message_id", waId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-webhook error", err);
    // Always 200 so Meta doesn't retry-storm us; we logged it.
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});