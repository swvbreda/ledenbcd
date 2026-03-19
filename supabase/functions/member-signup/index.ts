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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "E-mail en wachtwoord zijn verplicht" }),
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

    // Check if email is in allowed list
    const { data: allowed, error: lookupError } = await supabase
      .from("member_allowed_emails")
      .select("member_id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (lookupError) {
      console.error("Lookup error:", lookupError);
      return new Response(
        JSON.stringify({ error: "Fout bij controleren e-mailadres" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Dit e-mailadres is niet geregistreerd als lid. Neem contact op met het bestuur." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user
    const { data: authData, error: signupError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true, // Auto-confirm since we validated the email
      user_metadata: { member_id: allowed.member_id },
    });

    if (signupError) {
      if (signupError.message?.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Dit e-mailadres is al geregistreerd. Probeer in te loggen." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Signup error:", signupError);
      return new Response(
        JSON.stringify({ error: "Registratie mislukt. Probeer het opnieuw of neem contact op met het bestuur." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // Assign 'user' role
    await supabase.from("user_roles").insert({ user_id: userId, role: "user" });

    // Link user to member
    await supabase.from("member_profiles").insert({
      user_id: userId,
      member_id: allowed.member_id,
    });

    return new Response(
      JSON.stringify({ success: true, member_id: allowed.member_id }),
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
