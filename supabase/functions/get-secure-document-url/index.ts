import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: isUser } = await admin.rpc("has_role", { _user_id: user.id, _role: "user" });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isExtern } = await admin.rpc("has_role", { _user_id: user.id, _role: "extern" });
    // Mirror the RLS policy: external users must never receive members-only docs,
    // even if they also hold a 'user' role.
    if (isExtern && !isAdmin) {
      return new Response(JSON.stringify({ error: "Geen toegang" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isUser && !isAdmin) {
      return new Response(JSON.stringify({ error: "Geen toegang" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const slug = typeof body?.slug === "string" ? body.slug : "jaarplan";

    // Enforce the same audience filter as the underlying RLS policy: only
    // documents scoped to 'members' (or unrestricted) are accessible via
    // this endpoint. Admins keep full access.
    let docQuery = admin
      .from("secure_documents")
      .select("id, storage_path, title, audience")
      .eq("slug", slug);
    if (!isAdmin) {
      docQuery = docQuery.in("audience", ["members", "all"]);
    }
    const { data: doc, error: docErr } = await docQuery.maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document niet gevonden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("secure-documents")
      .createSignedUrl(doc.storage_path, 60);

    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: signErr?.message ?? "Kon URL niet maken" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log (fire & forget)
    admin.from("secure_document_views").insert({
      document_id: doc.id,
      user_id: user.id,
      user_email: user.email ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    }).then(() => {});

    return new Response(
      JSON.stringify({ url: signed.signedUrl, title: doc.title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});