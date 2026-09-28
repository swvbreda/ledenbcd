import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";


const input = z.object({ email: z.string().email().max(254) });
const generic = { accepted: true };

/** Never return account existence, an Auth session, or an authentication link. */
export const requestMemberLoginLink = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    if (import.meta.env.VITE_MEMBER_PASSWORDLESS_ENABLED !== "true" || process.env["MEMBER_PASSWORDLESS_SERVER_ENABLED"] !== "true") return { accepted: false };
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allowed, error: lookupError } = await supabaseAdmin
      .from("member_allowed_emails").select("member_id").eq("email", email).limit(2);
    if (lookupError || allowed?.length !== 1) return generic;
    const { data: member } = await supabaseAdmin.from("members_data")
      .select("member_type").eq("id", allowed[0].member_id).maybeSingle();
    if (member?.member_type !== "member") return generic;
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_member_login_link", { _email: email });
    if (claimError || !claimed) return generic;

    // Auth, not this function, creates/owns the one-time token and delivers it through
    // the configured Auth email sender. Never use generateLink or an app email here.
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const url = process.env['SUPABASE_URL'];
    if (!key || !url) return generic;
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const redirectOrigin = process.env["MEMBER_PORTAL_ORIGIN"];
    if (!redirectOrigin || !/^https:\/\/[^/]+$/.test(redirectOrigin)) return generic;
    await auth.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${redirectOrigin}/member-confirm`,
      },
    });
    return generic;
  });
