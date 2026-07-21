import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * This function is called via database webhook when a new member_edit_request is inserted.
 * It triggers a push notification to all admin users.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const INTERNAL_WEBHOOK_SECRET = Deno.env.get("INTERNAL_WEBHOOK_SECRET");

    if (!INTERNAL_WEBHOOK_SECRET) {
      throw new Error("INTERNAL_WEBHOOK_SECRET not configured");
    }

    // Only accept calls from trusted sources: DB trigger with service_role bearer
    // (sent via Vault) or an internal caller with the internal webhook secret.
    const authHeader = req.headers.get("authorization") ?? "";
    const internalSecret = req.headers.get("x-internal-secret") ?? "";
    const isServiceRole = SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    const isInternal = internalSecret === INTERNAL_WEBHOOK_SECRET;
    if (!isServiceRole && !isInternal) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, record } = await req.json();

    if (type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberId = record?.member_id;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        title: "Nieuw wijzigingsverzoek",
        body: `Lid #${memberId} heeft een wijzigingsverzoek ingediend.`,
        target_role: "admin",
      }),
    });

    const result = await response.json();
    console.log("Push result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-edit-request error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
