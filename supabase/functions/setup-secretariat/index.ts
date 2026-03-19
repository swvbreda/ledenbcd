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
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const email = "info@coffeeshopbond.nl";
    const tempPassword = "BCD-Secretariaat-2025!";

    // Check if user already exists
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existing = users?.find((u) => u.email === email);

    if (existing) {
      return new Response(JSON.stringify({ message: "User already exists", user_id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) throw createError;

    // Assign admin role
    if (userData?.user) {
      await adminClient.from("user_roles").insert({ user_id: userData.user.id, role: "admin" });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: userData.user?.id,
      message: `Account aangemaakt voor ${email} met tijdelijk wachtwoord` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
