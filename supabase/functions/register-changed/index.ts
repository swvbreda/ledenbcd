import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Ontvangstpunt voor pushmeldingen uit het project "Coffeeshopbeleid".
 *
 * Zodra daar een vergunning wijzigt, stuurt een databasetrigger een melding
 * hierheen. Deze function start dan de registersync (die aan het eind zelf de
 * ledenaanvulling aanroept). Meldingen binnen 60 seconden worden samengevoegd,
 * zodat een bulkimport niet tientallen runs veroorzaakt.
 */

const DEBOUNCE_SECONDS = 60;

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("REGISTER_PUSH_SECRET");
  const provided = req.headers.get("x-register-push-secret");
  const isService =
    (req.headers.get("authorization") ?? "") ===
    `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!isService && (!secret || provided !== secret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = admin();

  try {
    const { data: state, error: stateErr } = await db
      .from("coffeeshop_register_sync_state")
      .select("last_push_at")
      .eq("id", 1)
      .maybeSingle();
    if (stateErr) throw stateErr;

    const last = state?.last_push_at ? new Date(state.last_push_at).getTime() : 0;
    if (Date.now() - last < DEBOUNCE_SECONDS * 1000) {
      return new Response(JSON.stringify({ ok: true, skipped: "debounced" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await db
      .from("coffeeshop_register_sync_state")
      .update({ last_push_at: new Date().toISOString(), last_trigger: "push" })
      .eq("id", 1);

    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-coffeeshopregister`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ trigger: "push" }),
      },
    );
    const detail = await res.text().catch(() => "");

    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, detail: detail.slice(0, 500) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("register-changed mislukt:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
