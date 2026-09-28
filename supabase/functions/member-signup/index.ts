import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { invalidRequest, registerAllowedMember, SignupFailure } from "./signup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    const reference = `REG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    console.error(JSON.stringify({ event: "malformed_json", reference }));
    return new Response(JSON.stringify(invalidRequest(reference).body), { status: 400, headers: jsonHeaders });
  }

  try {

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const result = await registerAllowedMember(input, {
      reference: () => `REG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      log: (event, reference, details = {}) => console.error(JSON.stringify({ event, reference, ...details })),
      findAllowedMember: async (normalizedEmail) => {
        const { data: memberId, error: lookupError } = await supabase.rpc("get_member_id_for_email", {
          _email: normalizedEmail,
        });
        if (lookupError) throw lookupError;
        if (typeof memberId !== "number") return null;

        const { data: member, error: memberError } = await supabase
          .from("members_data")
          .select("id")
          .eq("id", memberId)
          .eq("member_type", "member")
          .maybeSingle();
        if (memberError) throw memberError;
        return member ? { memberId } : null;
      },
      createUser: async ({ email, password, memberId }) => {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { member_id: memberId },
        });
        if (error) throw error;
        if (!data.user) throw new SignupFailure("internal");
        return { id: data.user.id };
      },
      linkProfile: async (userId, memberId) => {
        const { error } = await supabase.from("member_profiles").upsert(
          { user_id: userId, member_id: memberId },
          { onConflict: "user_id" },
        );
        if (error) throw error;
      },
      assignMemberRole: async (userId) => {
        const { error } = await supabase.from("user_roles").upsert(
          { user_id: userId, role: "user" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
        if (error) throw error;
      },
      unlinkProfile: async (userId) => {
        const { error } = await supabase.from("member_profiles").delete().eq("user_id", userId);
        if (error) throw error;
      },
      deleteUser: async (userId) => {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) throw error;
      },
    });
    return new Response(
      JSON.stringify(result.body),
      { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    const reference = `REG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    console.error(JSON.stringify({ event: "invalid_signup_request", reference }));
    return new Response(
      JSON.stringify({ error: `Registratie kon niet worden verwerkt. Vermeld ${reference}.`, reference }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
