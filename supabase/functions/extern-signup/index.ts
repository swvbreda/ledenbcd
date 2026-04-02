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

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOrgName = organization_name.trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create the user account
    const { data: authData, error: signupError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
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
        contact_email: normalizedEmail,
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

      const benefitIds = new Set<string>();

      const { data: emailMatches, error: emailMatchError } = await supabase
        .from("member_benefits")
        .select("id")
        .is("supplier_org_id", null)
        .ilike("contact_email", normalizedEmail);

      if (emailMatchError) {
        console.error("Benefit email match error:", emailMatchError);
      }
      emailMatches?.forEach(({ id }) => benefitIds.add(id));

      const { data: nameMatches, error: nameMatchError } = await supabase
        .from("member_benefits")
        .select("id")
        .is("supplier_org_id", null)
        .ilike("provider_name", normalizedOrgName);

      if (nameMatchError) {
        console.error("Benefit provider match error:", nameMatchError);
      }
      nameMatches?.forEach(({ id }) => benefitIds.add(id));

      const benefitIdsList = Array.from(benefitIds);
      let benefitLinkError = null;

      if (benefitIdsList.length > 0) {
        const { error } = await supabase
          .from("member_benefits")
          .update({ supplier_org_id: orgData.id })
          .in("id", benefitIdsList);

        benefitLinkError = error;
      }

      if (benefitLinkError) {
        console.error("Benefit linking error:", benefitLinkError);
      }
    }

    // Notify admins via push notification
    try {
      const INTERNAL_WEBHOOK_SECRET = Deno.env.get("INTERNAL_WEBHOOK_SECRET");
      if (INTERNAL_WEBHOOK_SECRET) {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": INTERNAL_WEBHOOK_SECRET,
          },
          body: JSON.stringify({
            title: "Nieuwe externe aanvraag",
            body: `${organization_name.trim()} heeft zich aangemeld als externe partij.`,
            target_role: "admin",
          }),
        });
      }
    } catch (pushErr) {
      console.error("Push notification failed:", pushErr);
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
