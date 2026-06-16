// Send a WhatsApp message via Meta Cloud API.
// Body: { phone: string (E.164), text?: string, template?: { name, language, variables? } }
// - If `text` is supplied, sends as free-form text (only allowed within 24u of last inbound).
// - If `template` is supplied, sends as approved template (always allowed).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const WA_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function normalizeE164(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  // Meta expects "without +" in API but we store with +
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Role check: admin or board
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isBoard } = await admin.rpc("is_board_member", { _user_id: userId });
    if (!isAdmin && !isBoard) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // --- Validate config ---
    if (!WA_TOKEN || !WA_PHONE_ID) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured — add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Validate body ---
    const body = await req.json();
    const phone: string = body.phone;
    const text: string | undefined = body.text;
    const template: { name: string; language?: string; variables?: string[] } | undefined = body.template;
    const memberId: number | null = body.member_id ?? null;

    if (!phone || (!text && !template)) {
      return new Response(JSON.stringify({ error: "phone and (text or template) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const to = normalizeE164(phone);

    // --- Build Meta payload ---
    let metaBody: Record<string, unknown>;
    if (template) {
      metaBody = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language ?? "nl" },
          ...(template.variables && template.variables.length > 0
            ? {
                components: [
                  {
                    type: "body",
                    parameters: template.variables.map((v) => ({ type: "text", text: v })),
                  },
                ],
              }
            : {}),
        },
      };
    } else {
      metaBody = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      };
    }

    // --- Call Meta ---
    const metaRes = await fetch(`${GRAPH_BASE}/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaBody),
    });
    const metaJson = await metaRes.json();

    if (!metaRes.ok) {
      console.error("Meta API error", metaRes.status, metaJson);
      await admin.from("whatsapp_messages").insert({
        member_id: memberId,
        phone: `+${to}`,
        direction: "outbound",
        body: text ?? null,
        template_name: template?.name ?? null,
        template_variables: template?.variables ?? null,
        status: "failed",
        error: metaJson?.error?.message ?? `HTTP ${metaRes.status}`,
        sent_by: userId,
      });
      return new Response(JSON.stringify({ error: "Meta API failed", details: metaJson }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const waMessageId = metaJson?.messages?.[0]?.id ?? null;

    // Log message + update conversation
    await admin.from("whatsapp_messages").insert({
      wa_message_id: waMessageId,
      member_id: memberId,
      phone: `+${to}`,
      direction: "outbound",
      body: text ?? null,
      template_name: template?.name ?? null,
      template_variables: template?.variables ?? null,
      status: "sent",
      sent_by: userId,
    });

    const nowIso = new Date().toISOString();
    const preview = (text ?? `[template: ${template?.name}]`).slice(0, 140);
    const { data: existing } = await admin
      .from("whatsapp_conversations")
      .select("id")
      .eq("phone", `+${to}`)
      .maybeSingle();
    if (existing) {
      await admin
        .from("whatsapp_conversations")
        .update({
          member_id: memberId ?? undefined,
          last_outbound_at: nowIso,
          last_message_at: nowIso,
          last_message_preview: preview,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("whatsapp_conversations").insert({
        phone: `+${to}`,
        member_id: memberId,
        last_outbound_at: nowIso,
        last_message_at: nowIso,
        last_message_preview: preview,
      });
    }

    return new Response(JSON.stringify({ ok: true, wa_message_id: waMessageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-send error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});