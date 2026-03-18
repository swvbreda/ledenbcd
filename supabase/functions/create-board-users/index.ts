import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { users } = await req.json();

    const results = [];

    for (const user of users) {
      // Create user
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (createError) {
        results.push({ email: user.email, error: createError.message });
        continue;
      }

      // Assign admin role
      if (userData?.user && user.role) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: userData.user.id, role: user.role });

        if (roleError) {
          results.push({ email: user.email, created: true, roleError: roleError.message });
        } else {
          results.push({ email: user.email, created: true, role: user.role });
        }
      }
    }

    // Also assign admin role to existing simone account
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const simone = existingUsers?.users?.find((u) => u.email === "simone@coffeeshopbond.nl");
    if (simone) {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: simone.id, role: "admin" }, { onConflict: "user_id,role" });
      results.push({ email: "simone@coffeeshopbond.nl", existing: true, adminRole: !error });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
