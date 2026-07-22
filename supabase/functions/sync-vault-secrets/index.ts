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
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userRes.user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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