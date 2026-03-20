import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Build a signed JWT for APNs using ES256 (P-256 / prime256v1).
 */
async function createApnsJwt(
  keyId: string,
  teamId: string,
  privateKeyPem: string
): Promise<string> {
  const header = { alg: "ES256", kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: teamId, iat: now };

  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the PEM private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let raw: Uint8Array;
  if (sigBytes.length === 64) {
    raw = sigBytes;
  } else {
    // DER decode
    const rLen = sigBytes[3];
    const rStart = 4;
    const r = sigBytes.slice(rStart, rStart + rLen);
    const sLenIdx = rStart + rLen + 1;
    const sLen = sigBytes[sLenIdx];
    const sStart = sLenIdx + 1;
    const s = sigBytes.slice(sStart, sStart + sLen);

    raw = new Uint8Array(64);
    raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }

  const sigB64 = btoa(String.fromCharCode(...raw))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${sigB64}`;
}

async function sendApnsPush(
  deviceToken: string,
  title: string,
  body: string,
  bundleId: string,
  jwt: string
) {
  const url = `https://api.push.apple.com/3/device/${deviceToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: "default",
        badge: 1,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`APNs error ${res.status}: ${text}`);
  }
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
    if (!APNS_KEY_ID) throw new Error("APNS_KEY_ID not configured");

    const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
    if (!APNS_TEAM_ID) throw new Error("APNS_TEAM_ID not configured");

    const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY");
    if (!APNS_PRIVATE_KEY) throw new Error("APNS_PRIVATE_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { title, body: messageBody, target_role } = await req.json();

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all device tokens (optionally filter by admin role)
    let query = supabase.from("push_device_tokens").select("device_token, user_id");

    const { data: tokens, error: tokensError } = await query;
    if (tokensError) throw tokensError;

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No device tokens found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If target_role is specified, filter tokens by role
    let filteredTokens = tokens;
    if (target_role === "admin") {
      const { data: adminUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = new Set(adminUsers?.map((u) => u.user_id) ?? []);
      filteredTokens = tokens.filter((t) => adminIds.has(t.user_id));
    }

    const bundleId = "app.lovable.d12c81b41bf9487c88575f255db26beb";
    const jwt = await createApnsJwt(APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY);

    let sent = 0;
    for (const { device_token } of filteredTokens) {
      const ok = await sendApnsPush(device_token, title, messageBody, bundleId, jwt);
      if (ok) sent++;
    }

    return new Response(
      JSON.stringify({ success: true, sent, total: filteredTokens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-push error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
