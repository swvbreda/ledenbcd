import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Nodigt een externe organisatie (leverancier, bank, overheid) uit:
 * maakt de organisatie aan (indien nodig), maakt een account met een
 * tijdelijk wachtwoord, koppelt de rol `extern` en stuurt de uitnodiging.
 *
 * Alleen admins mogen deze functie aanroepen.
 */

const LOGIN_URL = "https://leden.coffeeshopbond.nl/extern-login";
const ALLOWED_TYPES = ["bank", "overheid", "leverancier", "anders"];

function tempPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map((b) => b.toString(36).padStart(2, "0")).join("");
  return `Bcd-${raw.slice(0, 14)}!`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Niet ingelogd" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    if (userError || !userData?.user?.id) return json({ error: "Niet ingelogd" }, 401);

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return json({ error: "Geen admin rechten" }, 403);

    const payload = await req.json().catch(() => ({}));
    const orgId = typeof payload.org_id === "string" ? payload.org_id : null;
    const name = String(payload.name ?? "").trim();
    const type = String(payload.type ?? "leverancier").trim();
    const contactName = String(payload.contact_name ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Ongeldig e-mailadres" }, 400);
    }
    if (!orgId && !name) {
      return json({ error: "Naam van de organisatie is verplicht" }, 400);
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return json({ error: "Ongeldig organisatietype" }, 400);
    }

    // 1. Organisatie ophalen of aanmaken (uitgenodigde partijen zijn direct goedgekeurd)
    let org: { id: string; name: string } | null = null;

    if (orgId) {
      const { data, error } = await admin
        .from("external_organizations")
        .select("id, name")
        .eq("id", orgId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Organisatie niet gevonden" }, 404);
      org = data as { id: string; name: string };

      await admin
        .from("external_organizations")
        .update({
          approved: true,
          approved_by: userData.user.id,
          approved_at: new Date().toISOString(),
          contact_email: email,
          ...(contactName ? { contact_name: contactName } : {}),
        })
        .eq("id", org.id);
    } else {
      const { data, error } = await admin
        .from("external_organizations")
        .insert({
          name,
          type,
          contact_email: email,
          contact_name: contactName || null,
          approved: true,
          approved_by: userData.user.id,
          approved_at: new Date().toISOString(),
        })
        .select("id, name")
        .single();
      if (error) throw error;
      org = data as { id: string; name: string };
    }

    // 2. Account aanmaken of hergebruiken
    const password = tempPassword();
    let userId: string | null = null;
    let isNewAccount = true;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { extern: true, organization_name: org.name },
    });

    if (createError) {
      if (!createError.message?.includes("already been registered")) throw createError;

      isNewAccount = false;
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) return json({ error: "Bestaand account kon niet worden gevonden" }, 500);
      userId = existing.id;

      // Bestaand account: nieuw tijdelijk wachtwoord zetten zodat de uitnodiging klopt
      const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password });
      if (pwError) throw pwError;
    } else {
      userId = created.user!.id;
    }

    // 3. Rol en koppeling met organisatie
    await admin.from("user_roles").upsert({ user_id: userId, role: "extern" }, { onConflict: "user_id,role" });

    const { data: linkExists } = await admin
      .from("external_org_users")
      .select("org_id")
      .eq("org_id", org.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!linkExists) {
      await admin.from("external_org_users").insert({ org_id: org.id, user_id: userId });
    }

    // 4. Uitnodiging mailen
    const mailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        templateName: "extern-invite",
        recipientEmail: email,
        idempotencyKey: `extern-invite:${org.id}:${email}:${Date.now()}`,
        templateData: {
          organisatie: org.name,
          contactpersoon: contactName || null,
          email,
          wachtwoord: password,
          loginUrl: LOGIN_URL,
        },
      }),
    });

    if (!mailRes.ok) {
      const detail = await mailRes.text().catch(() => "");
      console.error("invite-extern mail failed:", mailRes.status, detail.slice(0, 500));
      return json(
        {
          success: false,
          org_id: org.id,
          error: "Account is aangemaakt, maar de uitnodigingsmail kon niet worden verstuurd.",
          detail: detail.slice(0, 300),
        },
        502,
      );
    }

    return json({ success: true, org_id: org.id, user_id: userId, new_account: isNewAccount });
  } catch (error) {
    console.error("invite-extern error:", error);
    return json({ error: String((error as Error).message ?? error) }, 500);
  }
});
