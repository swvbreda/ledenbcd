import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, organization_name, organization_type, contact_name } = await req.json();

    if (!email || !password || !organization_name || !contact_name) {
      return new Response(
        JSON.stringify({ error: "Alle velden zijn verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Wachtwoord moet minimaal 8 tekens zijn" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create the user account
    const { data: authData, error: signupError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { extern: true, organization_name },
    });

    if (signupError) {
      if (signupError.message?.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Dit e-mailadres is al geregistreerd." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Signup error:", signupError);
      return new Response(
        JSON.stringify({ error: "Registratie mislukt. Probeer het opnieuw." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // Assign 'extern' role
    await supabase.from("user_roles").insert({ user_id: userId, role: "extern" });

    // Create the organization (not yet approved)
    const { data: orgData, error: orgError } = await supabase
      .from("external_organizations")
      .insert({
        name: organization_name.trim(),
        type: organization_type || "bank",
        contact_email: email.toLowerCase().trim(),
        contact_name: contact_name.trim(),
      })
      .select("id")
      .single();

    if (orgError) {
      console.error("Org creation error:", orgError);
      // Still return success since user was created
    }

    // Link user to organization
    if (orgData) {
      await supabase.from("external_org_users").insert({
        org_id: orgData.id,
        user_id: userId,
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Er is een onverwachte fout opgetreden" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
