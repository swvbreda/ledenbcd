import { createClient } from "npm:@supabase/supabase-js@2";

const EXPECTED_SECRET = "bcd-reviewer-setup-2026";
const REVIEWER_USER_ID = "9a35c5c8-9928-4b80-8ece-59aeea5601df";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const { secret, password } = await req.json().catch(() => ({}));
  if (secret !== EXPECTED_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!password) {
    return new Response("Missing password", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.auth.admin.updateUserById(REVIEWER_USER_ID, {
    password,
    user_metadata: { is_reviewer: true, full_name: "Reviewer Apple" },
    email_confirm: true,
  });
  if (error) throw error;

  return Response.json({ ok: true, userId: data.user!.id });
});
