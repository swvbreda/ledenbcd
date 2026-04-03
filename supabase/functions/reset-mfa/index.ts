import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get the user's JWT to identify them
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create anon client to get user from JWT
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin client to list and unenroll all TOTP factors
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's factors via admin API
    const { data: adminUser, error: adminError } = await adminClient.auth.admin.getUserById(user.id);
    if (adminError || !adminUser?.user) {
      return new Response(JSON.stringify({ error: "Could not fetch user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const factors = adminUser.user.factors || [];
    const totpFactors = factors.filter((f: any) => f.factor_type === "totp");

    let unenrolled = 0;
    for (const factor of totpFactors) {
      // Use admin API to delete the factor directly
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${user.id}/factors/${factor.id}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );
      if (res.ok) unenrolled++;
      else console.error(`Failed to unenroll factor ${factor.id}:`, await res.text());
    }

    // Also clear email MFA localStorage marker (handled client-side)
    
    return new Response(
      JSON.stringify({ success: true, unenrolled, total: totpFactors.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("reset-mfa error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
