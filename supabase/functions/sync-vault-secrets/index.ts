// Eenmalig maintenance-endpoint: schrijft de actuele SUPABASE_SERVICE_ROLE_KEY
// van de edge runtime terug naar Postgres Vault onder de naam
// `email_queue_service_role_key`. Dit is nodig na een signing-keys-rotatie,
// omdat DB-triggers de vault-waarde als bearer token gebruiken naar andere
// edge functions. Alleen aanroepbaar door een ingelogde admin.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Eenmalig maintenance-endpoint. De request payload beïnvloedt niks: de
  // functie schrijft alleen de eigen edge-env-variabele SERVICE_ROLE_KEY
  // terug naar vault. Wordt na gebruik verwijderd.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error: e1 } = await admin.rpc("set_vault_secret", {
    _name: "email_queue_service_role_key",
    _value: SERVICE_KEY,
  });
  if (e1) {
    return new Response(JSON.stringify({ error: e1.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, updated: ["email_queue_service_role_key"] }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});