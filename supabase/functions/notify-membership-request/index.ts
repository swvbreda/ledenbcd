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

    // 2) Push to admins
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