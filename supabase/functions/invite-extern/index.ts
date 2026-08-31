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

    // Contactpersonen: nieuw formaat `contacts: [{ name, email, role, phone }]`,
    // met terugvalcompatibiliteit op het oude `contact_name` / `email`.
    const rawContacts = Array.isArray(payload.contacts) && payload.contacts.length > 0
      ? payload.contacts
      : [{ name: payload.contact_name, email: payload.email }];

    const contacts = rawContacts
      .map((c: Record<string, unknown>) => ({
        name: String(c?.name ?? "").trim(),
        email: String(c?.email ?? "").trim().toLowerCase(),
        role: String(c?.role ?? "").trim(),
        phone: String(c?.phone ?? "").trim(),
      }))
      .filter((c) => c.email.length > 0);

    if (contacts.length === 0) {
      return json({ error: "Vul minimaal één e-mailadres in" }, 400);
    }
    for (const c of contacts) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
        return json({ error: `Ongeldig e-mailadres: ${c.email}` }, 400);
      }
    }
    // Ontdubbelen op e-mailadres
    const seen = new Set<string>();
    const uniqueContacts = contacts.filter((c) => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return true;
    });

    const primary = uniqueContacts[0];

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
          contact_email: primary.email,
          ...(primary.name ? { contact_name: primary.name } : {}),
        })
        .eq("id", org.id);
    } else {
      const { data, error } = await admin
        .from("external_organizations")
        .insert({
          name,
          type,
          contact_email: primary.email,
          contact_name: primary.name || null,
          approved: true,
          approved_by: userData.user.id,
          approved_at: new Date().toISOString(),
        })
        .select("id, name")
        .single();
      if (error) throw error;
      org = data as { id: string; name: string };
    }

    const results: Array<{ email: string; status: string; error?: string }> = [];

    for (const contact of uniqueContacts) {
      const email = contact.email;
      try {
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
          if (!existing) throw new Error("Bestaand account kon niet worden gevonden");
          userId = existing.id;

          const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password });
          if (pwError) throw pwError;
        } else {
          userId = created.user!.id;
        }

        // 3. Rol en koppeling met organisatie
        await admin.from("user_roles").upsert(
          { user_id: userId, role: "extern" },
          { onConflict: "user_id,role" },
        );

        const { data: linkExists } = await admin
          .from("external_org_users")
          .select("org_id")
          .eq("org_id", org.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!linkExists) {
          await admin.from("external_org_users").insert({ org_id: org.id, user_id: userId });
        }

        // 3b. Contactpersoon vastleggen bij de organisatie
        const { data: contactExists } = await admin
          .from("external_org_contacts")
          .select("id")
          .eq("org_id", org.id)
          .ilike("email", email)
          .maybeSingle();

        if (contactExists) {
          const updates: Record<string, unknown> = {};
          if (contact.name) updates.name = contact.name;
          if (contact.role) updates.role = contact.role;
          if (contact.phone) updates.phone = contact.phone;
          if (Object.keys(updates).length > 0) {
            await admin.from("external_org_contacts").update(updates).eq("id", contactExists.id);
          }
        } else {
          await admin.from("external_org_contacts").insert({
            org_id: org.id,
            name: contact.name || email,
            email,
            role: contact.role || null,
            phone: contact.phone || null,
          });
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
              contactpersoon: contact.name || null,
              email,
              wachtwoord: password,
              loginUrl: LOGIN_URL,
            },
          }),
        });

        if (!mailRes.ok) {
          const detail = await mailRes.text().catch(() => "");
          console.error("invite-extern mail failed:", email, mailRes.status, detail.slice(0, 300));
          results.push({
            email,
            status: "mail_failed",
            error: "Account aangemaakt, maar de uitnodigingsmail kon niet worden verstuurd.",
          });
          continue;
        }

        results.push({ email, status: isNewAccount ? "sent" : "sent_existing_account" });
      } catch (contactError) {
        console.error("invite-extern contact failed:", email, contactError);
        results.push({
          email,
          status: "error",
          error: String((contactError as Error).message ?? contactError),
        });
      }
    }

    const sent = results.filter((r) => r.status.startsWith("sent")).length;

    return json({
      success: sent > 0,
      org_id: org.id,
      sent,
      total: results.length,
      results,
      ...(sent === 0 ? { error: results[0]?.error ?? "Uitnodigen mislukt" } : {}),
    }, sent > 0 ? 200 : 502);
  } catch (error) {
    console.error("invite-extern error:", error);
    return json({ error: String((error as Error).message ?? error) }, 500);
  }
});

