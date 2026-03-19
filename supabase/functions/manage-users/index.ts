import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Niet ingelogd" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    let payload: Record<string, unknown> = {};

    if (req.method !== "GET") {
      try {
        payload = await req.json();
      } catch {
        payload = {};
      }
    }

    const action = (url.searchParams.get("action") || (payload.action as string) || "list").toLowerCase();

    if (action === "list") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers();
      if (error) throw error;

      const { data: roles } = await adminClient.from("user_roles").select("*");
      const roleMap = new Map<string, string>();
      roles?.forEach((r) => roleMap.set(r.user_id, r.role));

      const { data: profiles } = await adminClient.from("member_profiles").select("user_id, member_id");
      const profileMap = new Map<string, number[]>();
      profiles?.forEach((p) => {
        const arr = profileMap.get(p.user_id) || [];
        arr.push(p.member_id);
        profileMap.set(p.user_id, arr);
      });

      const result = users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role: roleMap.get(u.id) || "user",
        member_ids: profileMap.get(u.id) || [],
        member_id: (profileMap.get(u.id) || [])[0] || null,
      }));

      return new Response(JSON.stringify({ users: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const email = payload.email as string | undefined;
      const password = payload.password as string | undefined;
      const role = payload.role as string | undefined;

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "E-mail en wachtwoord zijn verplicht" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      if (userData?.user && role) {
        await adminClient.from("user_roles").insert({ user_id: userData.user.id, role });
      }

      return new Response(JSON.stringify({ success: true, user_id: userData.user?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const user_id = payload.user_id as string | undefined;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id ontbreekt" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Je kunt je eigen account niet verwijderen" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const user_id = payload.user_id as string | undefined;
      const role = payload.role as string | undefined;

      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id en role zijn verplicht" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("user_roles").upsert(
        { user_id, role },
        { onConflict: "user_id,role" }
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "link_member") {
      const user_id = payload.user_id as string | undefined;
      const member_id = payload.member_id as number | undefined;

      if (!user_id || !member_id) {
        return new Response(JSON.stringify({ error: "user_id en member_id zijn verplicht" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.from("member_profiles").insert({ user_id, member_id });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unlink_member") {
      const user_id = payload.user_id as string | undefined;
      const member_id = payload.member_id as number | undefined;

      if (!user_id || !member_id) {
        return new Response(JSON.stringify({ error: "user_id en member_id zijn verplicht" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.from("member_profiles").delete()
        .eq("user_id", user_id)
        .eq("member_id", member_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_user") {
      const user_id = payload.user_id as string | undefined;
      const email = payload.email as string | undefined;
      const role = payload.role as string | undefined;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is verplicht" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update email if provided
      if (email) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, { email });
        if (updateError) throw updateError;
      }

      // Update role if provided
      if (role) {
        // Delete existing roles and insert new one
        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        if (role !== "user") {
          await adminClient.from("user_roles").insert({ user_id, role });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Onbekende actie" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
