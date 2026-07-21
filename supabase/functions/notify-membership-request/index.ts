import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_EMAIL = "info@coffeeshopbond.nl";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const INTERNAL_SECRET = Deno.env.get("INTERNAL_WEBHOOK_SECRET");

    // Only accept calls from trusted sources: DB trigger with service_role bearer
    // (sent via Vault) or an internal caller with the internal webhook secret.
    const authHeader = req.headers.get("authorization") ?? "";
    const internalSecret = req.headers.get("x-internal-secret") ?? "";
    const isServiceRole = SERVICE_KEY && authHeader === `Bearer ${SERVICE_KEY}`;
    const isInternal = INTERNAL_SECRET && internalSecret === INTERNAL_SECRET;
    if (!isServiceRole && !isInternal) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, record } = await req.json();
    if (type !== "INSERT" || !record?.id) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: row } = await supabase
      .from("membership_requests")
      .select("*")
      .eq("id", record.id)
      .maybeSingle();
    const r = row ?? record;

    // 1) Email to info@coffeeshopbond.nl via send-transactional-email
    const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        templateName: "membership-request",
        recipientEmail: NOTIFY_EMAIL,
        idempotencyKey: `membership-request-${r.id}`,
        templateData: {
          full_name: r.full_name,
          email: r.email,
          coffeeshop_name: r.coffeeshop_name,
          city: r.city,
          phone: r.phone,
          message: r.message,
        },
      }),
    });
    const emailJson = await emailRes.json().catch(() => ({}));
    console.log("email result", emailRes.status, emailJson);

    // 2) Bevestigingsmail naar de aanmelder zelf
    if (r.email) {
      const naam = (r.full_name || "").trim().split(/\s+/)[0] || "";
      const shop = r.coffeeshop_name || "je coffeeshop";
      const body = [
        `Beste ${naam || "aanmelder"},`,
        `Bedankt voor je aanmelding bij de Bond van Cannabis Detaillisten namens ${shop}. We hebben je aanvraag goed ontvangen.`,
        `Wat gebeurt er nu?\n• Je account is automatisch aangemaakt en je toegang tot het ledenportaal wordt geregeld.\n• Het secretariaat controleert je gegevens en neemt binnen enkele werkdagen contact met je op voor de laatste stappen (contributie en bevestiging).\n• Zodra alles rond is, ontvang je een aparte mail met je inloggegevens voor leden.coffeeshopbond.nl.`,
        `Heb je in de tussentijd vragen? Mail gerust naar info@coffeeshopbond.nl.`,
        `Met vriendelijke groet,\nBestuur BCD`,
      ].join("\n\n");

      try {
        const confirmRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            templateName: "member-welcome",
            recipientEmail: r.email,
            idempotencyKey: `membership-request-confirm-${r.id}`,
            templateData: {
              subject: "Aanmelding ontvangen — Bond van Cannabis Detaillisten",
              body,
            },
          }),
        });
        console.log("confirmation email result", confirmRes.status);
      } catch (e) {
        console.error("confirmation email failed", e);
      }
    }

    // 3) Push to admins
    if (INTERNAL_SECRET) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
          body: JSON.stringify({
            title: "Nieuwe aanmelding",
            body: `${r.coffeeshop_name || r.full_name} uit ${r.city || "?"} meldt zich aan.`,
            target_role: "admin",
          }),
        });
      } catch (e) {
        console.error("push failed", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, email: emailJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-membership-request error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});