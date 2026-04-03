import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RP_NAME = "BCD Ledenportaal";
const RP_ID = "leden.coffeeshopbond.nl";
const ORIGIN = "https://leden.coffeeshopbond.nl";

// Simple base64url encode/decode
function base64urlEncode(buffer: Uint8Array): string {
  let str = "";
  for (const byte of buffer) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomChallenge(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr);
}

// In-memory challenge store (short-lived, edge function instance scope)
const challenges = new Map<string, { challenge: string; timestamp: number }>();

function storeChallenge(key: string, challenge: string) {
  // Clean old challenges (>5 min)
  const now = Date.now();
  for (const [k, v] of challenges) {
    if (now - v.timestamp > 300_000) challenges.delete(k);
  }
  challenges.set(key, { challenge, timestamp: now });
}

function getAndDeleteChallenge(key: string): string | null {
  const entry = challenges.get(key);
  if (!entry) return null;
  challenges.delete(key);
  if (Date.now() - entry.timestamp > 300_000) return null;
  return entry.challenge;
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getUserFromAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return { id: data.claims.sub as string, email: data.claims.email as string };
}

// Extract public key from attestation object (for "none" attestation)
function extractPublicKeyFromAuthData(authData: Uint8Array): Uint8Array {
  // authData structure: rpIdHash(32) + flags(1) + counter(4) + attestedCredData
  // attestedCredData: aaguid(16) + credIdLen(2) + credId(credIdLen) + credentialPublicKey(CBOR)
  const flags = authData[32];
  const hasAttestedData = (flags & 0x40) !== 0;
  if (!hasAttestedData) throw new Error("No attested credential data");

  let offset = 37; // skip rpIdHash + flags + counter
  offset += 16; // skip aaguid
  const credIdLen = (authData[offset] << 8) | authData[offset + 1];
  offset += 2 + credIdLen; // skip credId

  // The rest is the COSE public key — store it as-is
  return authData.slice(offset);
}

// Minimal CBOR decoder for COSE keys and attestation objects
function decodeCBOR(data: Uint8Array, offset = 0): { value: any; bytesRead: number } {
  const major = data[offset] >> 5;
  const additional = data[offset] & 0x1f;

  function readLength(additional: number, startOffset: number): { len: number; bytesUsed: number } {
    if (additional < 24) return { len: additional, bytesUsed: 1 };
    if (additional === 24) return { len: data[startOffset + 1], bytesUsed: 2 };
    if (additional === 25) return { len: (data[startOffset + 1] << 8) | data[startOffset + 2], bytesUsed: 3 };
    if (additional === 26) {
      return {
        len: (data[startOffset + 1] << 24) | (data[startOffset + 2] << 16) | (data[startOffset + 3] << 8) | data[startOffset + 4],
        bytesUsed: 5,
      };
    }
    throw new Error("Unsupported CBOR length");
  }

  if (major === 0) { // unsigned int
    const { len, bytesUsed } = readLength(additional, offset);
    return { value: len, bytesRead: bytesUsed };
  }
  if (major === 1) { // negative int
    const { len, bytesUsed } = readLength(additional, offset);
    return { value: -1 - len, bytesRead: bytesUsed };
  }
  if (major === 2) { // byte string
    const { len, bytesUsed } = readLength(additional, offset);
    return { value: data.slice(offset + bytesUsed, offset + bytesUsed + len), bytesRead: bytesUsed + len };
  }
  if (major === 3) { // text string
    const { len, bytesUsed } = readLength(additional, offset);
    const textBytes = data.slice(offset + bytesUsed, offset + bytesUsed + len);
    return { value: new TextDecoder().decode(textBytes), bytesRead: bytesUsed + len };
  }
  if (major === 4) { // array
    const { len, bytesUsed } = readLength(additional, offset);
    const arr: any[] = [];
    let pos = bytesUsed;
    for (let i = 0; i < len; i++) {
      const { value, bytesRead } = decodeCBOR(data, offset + pos);
      arr.push(value);
      pos += bytesRead;
    }
    return { value: arr, bytesRead: pos };
  }
  if (major === 5) { // map
    const { len, bytesUsed } = readLength(additional, offset);
    const map = new Map();
    let pos = bytesUsed;
    for (let i = 0; i < len; i++) {
      const { value: key, bytesRead: kr } = decodeCBOR(data, offset + pos);
      pos += kr;
      const { value: val, bytesRead: vr } = decodeCBOR(data, offset + pos);
      pos += vr;
      map.set(key, val);
    }
    return { value: map, bytesRead: pos };
  }
  if (major === 7) { // simple/float
    if (additional === 20) return { value: false, bytesRead: 1 };
    if (additional === 21) return { value: true, bytesRead: 1 };
    if (additional === 22) return { value: null, bytesRead: 1 };
    throw new Error(`Unsupported CBOR simple value: ${additional}`);
  }
  throw new Error(`Unsupported CBOR major type: ${major}`);
}

// Import COSE ES256 public key for verification
async function importCOSEPublicKey(coseKeyBytes: Uint8Array): Promise<CryptoKey> {
  const { value: coseMap } = decodeCBOR(coseKeyBytes);
  // COSE key map: 1=kty, 3=alg, -1=crv, -2=x, -3=y
  const x = coseMap.get(-2) as Uint8Array;
  const y = coseMap.get(-3) as Uint8Array;
  // Build uncompressed point: 0x04 || x || y
  const uncompressed = new Uint8Array(1 + x.length + y.length);
  uncompressed[0] = 0x04;
  uncompressed.set(x, 1);
  uncompressed.set(y, 1 + x.length);
  return crypto.subtle.importKey(
    "raw",
    uncompressed,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

// Verify ES256 signature
async function verifySignature(publicKey: CryptoKey, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  // WebAuthn uses DER-encoded signature, Web Crypto needs raw r||s
  const rawSig = derToRaw(signature);
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    rawSig,
    data
  );
}

function derToRaw(der: Uint8Array): Uint8Array {
  // Parse DER SEQUENCE { INTEGER r, INTEGER s }
  if (der[0] !== 0x30) throw new Error("Invalid DER signature");
  let offset = 2;
  // r
  if (der[offset] !== 0x02) throw new Error("Invalid DER");
  const rLen = der[offset + 1];
  offset += 2;
  let r = der.slice(offset, offset + rLen);
  offset += rLen;
  // s
  if (der[offset] !== 0x02) throw new Error("Invalid DER");
  const sLen = der[offset + 1];
  offset += 2;
  let s = der.slice(offset, offset + sLen);
  // Trim leading zeros / pad to 32 bytes
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Registration: generate options ──
    if (action === "register-options") {
      const user = await getUserFromAuth(req);
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const db = getServiceClient();
      const { data: existing } = await db.from("passkey_credentials").select("credential_id").eq("user_id", user.id);
      const excludeCredentials = (existing || []).map((c: any) => ({
        id: c.credential_id,
        type: "public-key",
      }));

      const challenge = randomChallenge();
      storeChallenge(`reg_${user.id}`, challenge);

      const options = {
        challenge,
        rp: { name: RP_NAME, id: RP_ID },
        user: {
          id: base64urlEncode(new TextEncoder().encode(user.id)),
          name: user.email,
          displayName: user.email.split("@")[0],
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
        excludeCredentials,
      };

      return new Response(JSON.stringify(options), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Registration: verify ──
    if (action === "register-verify") {
      const user = await getUserFromAuth(req);
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const body = await req.json();
      const { credential, deviceName } = body;

      const expectedChallenge = getAndDeleteChallenge(`reg_${user.id}`);
      if (!expectedChallenge) {
        return new Response(JSON.stringify({ error: "Challenge expired" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Decode attestation response
      const clientDataJSON = base64urlDecode(credential.response.clientDataJSON);
      const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

      // Verify challenge
      if (clientData.challenge !== expectedChallenge) {
        return new Response(JSON.stringify({ error: "Challenge mismatch" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (clientData.type !== "webauthn.create") {
        return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Decode attestation object
      const attestationObject = base64urlDecode(credential.response.attestationObject);
      const { value: attObj } = decodeCBOR(attestationObject);
      const authData = attObj.get("authData") as Uint8Array;

      // Extract credential ID and public key from authData
      const flags = authData[32];
      const counter = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];

      let offset = 37;
      offset += 16; // aaguid
      const credIdLen = (authData[offset] << 8) | authData[offset + 1];
      offset += 2;
      const credentialIdBytes = authData.slice(offset, offset + credIdLen);
      offset += credIdLen;
      const publicKeyBytes = authData.slice(offset);

      const credentialId = base64urlEncode(credentialIdBytes);
      const publicKey = base64urlEncode(publicKeyBytes);

      // Store in database
      const db = getServiceClient();
      const { error: insertErr } = await db.from("passkey_credentials").insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKey,
        counter,
        device_name: deviceName || null,
        transports: credential.response.transports || [],
      });

      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to store credential" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Authentication: generate options ──
    if (action === "auth-options") {
      const body = await req.json().catch(() => ({}));
      const email = body.email;

      const challenge = randomChallenge();
      const challengeKey = email ? `auth_${email}` : `auth_anon_${challenge}`;
      storeChallenge(challengeKey, challenge);

      const db = getServiceClient();
      let allowCredentials: any[] = [];

      if (email) {
        // Look up user by email to find their passkeys
        const { data: userData } = await db.auth.admin.listUsers();
        const matchedUser = userData?.users?.find((u: any) => u.email === email);
        if (matchedUser) {
          const { data: creds } = await db.from("passkey_credentials")
            .select("credential_id, transports")
            .eq("user_id", matchedUser.id);
          allowCredentials = (creds || []).map((c: any) => ({
            id: c.credential_id,
            type: "public-key",
            transports: c.transports || [],
          }));
        }
      }

      const options: any = {
        challenge,
        challengeKey,
        rpId: RP_ID,
        timeout: 60000,
        userVerification: "required",
      };

      if (allowCredentials.length > 0) {
        options.allowCredentials = allowCredentials;
      }

      return new Response(JSON.stringify(options), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Authentication: verify ──
    if (action === "auth-verify") {
      const body = await req.json();
      const { credential, challengeKey } = body;

      const expectedChallenge = getAndDeleteChallenge(challengeKey);
      if (!expectedChallenge) {
        return new Response(JSON.stringify({ error: "Challenge expired" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Look up credential
      const credentialId = credential.id;
      const db = getServiceClient();
      const { data: credData, error: credErr } = await db.from("passkey_credentials")
        .select("*")
        .eq("credential_id", credentialId)
        .single();

      if (credErr || !credData) {
        return new Response(JSON.stringify({ error: "Unknown credential" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Decode and verify clientDataJSON
      const clientDataJSON = base64urlDecode(credential.response.clientDataJSON);
      const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

      if (clientData.challenge !== expectedChallenge) {
        return new Response(JSON.stringify({ error: "Challenge mismatch" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (clientData.type !== "webauthn.get") {
        return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verify signature
      const authData = base64urlDecode(credential.response.authenticatorData);
      const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataJSON));
      const signedData = new Uint8Array(authData.length + clientDataHash.length);
      signedData.set(authData, 0);
      signedData.set(clientDataHash, authData.length);

      const publicKeyBytes = base64urlDecode(credData.public_key);
      const publicKey = await importCOSEPublicKey(publicKeyBytes);
      const signature = base64urlDecode(credential.response.signature);

      const valid = await verifySignature(publicKey, signature, signedData);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Update counter
      const newCounter = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
      if (newCounter > 0 && newCounter <= credData.counter) {
        return new Response(JSON.stringify({ error: "Possible cloned authenticator" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await db.from("passkey_credentials").update({ counter: newCounter }).eq("id", credData.id);

      // Generate a session token for the user
      // Use admin API to generate a magic link or custom token
      const { data: userData } = await db.auth.admin.getUserById(credData.user_id);
      if (!userData?.user?.email) {
        return new Response(JSON.stringify({ error: "User not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Generate a short-lived sign-in link
      const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
        type: "magiclink",
        email: userData.user.email,
        options: { redirectTo: ORIGIN },
      });

      if (linkErr || !linkData) {
        return new Response(JSON.stringify({ error: "Failed to create session" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Extract the token from the link
      const token_hash = linkData.properties?.hashed_token;
      
      // Verify the OTP to get a session
      const { data: sessionData, error: sessionErr } = await db.auth.verifyOtp({
        type: "magiclink",
        token_hash: token_hash!,
      });

      if (sessionErr || !sessionData?.session) {
        return new Response(JSON.stringify({ error: "Failed to create session" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: true,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("WebAuthn error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
