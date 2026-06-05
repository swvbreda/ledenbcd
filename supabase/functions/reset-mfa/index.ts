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

    const token = authHeader.replace("Bearer ", "");

    // Verify JWT via Supabase (JWKS-backed)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: verified, error: verifyErr } = await adminClient.auth.getUser(token);
    if (verifyErr || !verified?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = verified.user.id;

    const { data: adminUser, error: adminError } = await adminClient.auth.admin.getUserById(userId);
    
    if (adminError || !adminUser?.user) {
      console.error("getUserById error:", adminError);
      return new Response(JSON.stringify({ error: "Could not fetch user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const factors = adminUser.user.factors || [];
    const totpFactors = factors.filter((f: any) => f.factor_type === "totp");

    let unenrolled = 0;
    for (const factor of totpFactors) {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${userId}/factors/${factor.id}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );
      if (res.ok) {
        unenrolled++;
        console.log(`Unenrolled factor ${factor.id} for user ${userId}`);
      } else {
        console.error(`Failed to unenroll factor ${factor.id}:`, await res.text());
      }
    }

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
