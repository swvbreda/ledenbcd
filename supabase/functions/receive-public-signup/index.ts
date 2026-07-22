// Public webhook that receives membership signup requests from coffeeshopbond.nl
// and inserts them into public.membership_requests. The DB trigger
// `auto_create_member_from_request` handles creating the lead/member row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signup-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  full_name?: string;
  email?: string;
  coffeeshop_name?: string;
  city?: string;
  phone?: string | null;
  address?: string | null;
  locations_count?: number | null;
  role_in_shop?: string | null;
  message?: string | null;
  request_type?: "member" | "lead";
  source?: string;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const expectedSecret = Deno.env.get("PUBLIC_SIGNUP_WEBHOOK_SECRET");
  const providedSecret = req.headers.get("x-signup-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json(401, { error: "Unauthorized" });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const full_name = (body.full_name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const coffeeshop_name = (body.coffeeshop_name ?? "").trim();
  const city = (body.city ?? "").trim();
  const request_type = body.request_type === "lead" ? "lead" : "member";

  if (!full_name || !email || !coffeeshop_name || !city) {
    return json(400, { error: "Missing required fields" });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return json(400, { error: "Invalid email" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("membership_requests")
    .insert({
      full_name,
      email,
      coffeeshop_name,
      city,
      phone: body.phone ?? null,
      message: body.message ?? null,
      request_type,
    })
    .select("id, status, request_type")
    .maybeSingle();

  if (error) {
    console.error("[receive-public-signup] insert failed", error);
    return json(500, { error: "Insert failed", details: error.message });
  }

  return json(200, { ok: true, request: data });
});