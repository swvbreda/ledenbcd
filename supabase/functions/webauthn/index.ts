import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RP_NAME = "BCD Ledenportaal";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type ChallengeAction = "register" | "auth";

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

type ChallengePayload = {
  action: ChallengeAction;
  challenge: string;
  expiresAt: number;
  origin: string;
  rpId: string;
  userId?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

function getChallengeSecret() {
  return Deno.env.get("INTERNAL_WEBHOOK_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

async function getChallengeKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getChallengeSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createChallengeToken(payload: ChallengePayload) {
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const key = await getChallengeKey();
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
  return `${base64urlEncode(payloadBytes)}.${base64urlEncode(signature)}`;
}

async function verifyChallengeToken(token: string): Promise<ChallengePayload | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  try {
    const payloadBytes = base64urlDecode(payloadPart);
    const signature = base64urlDecode(signaturePart);
    const key = await getChallengeKey();
    const isValid = await crypto.subtle.verify("HMAC", key, toArrayBuffer(signature), toArrayBuffer(payloadBytes));
    if (!isValid) return null;

    const payload = JSON.parse(decoder.decode(payloadBytes)) as ChallengePayload;
    if (!payload?.challenge || !payload?.origin || !payload?.rpId || !payload?.action || !payload?.expiresAt) {
      return null;
    }

    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

function getRequestOrigin(req: Request) {
  const originHeader = req.headers.get("origin");
  if (originHeader) return originHeader;
  return new URL(req.url).origin;
}

function getRequestRpId(req: Request) {
  return new URL(getRequestOrigin(req)).hostname;
}

async function matchesRpIdHash(authData: Uint8Array, rpId: string) {
  const expectedHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(rpId)));
  const actualHash = authData.slice(0, 32);
  return expectedHash.every((byte, index) => actualHash[index] === byte);
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
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? "" };
}

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

  if (major === 0) {
    const { len, bytesUsed } = readLength(additional, offset);
    return { value: len, bytesRead: bytesUsed };
  }
  if (major === 1) {
    const { len, bytesUsed } = readLength(additional, offset);
    return { value: -1 - len, bytesRead: bytesUsed };
  }
  if (major === 2) {
    const { len, bytesUsed } = readLength(additional, offset);
    return { value: data.slice(offset + bytesUsed, offset + bytesUsed + len), bytesRead: bytesUsed + len };
  }
  if (major === 3) {
    const { len, bytesUsed } = readLength(additional, offset);
    const textBytes = data.slice(offset + bytesUsed, offset + bytesUsed + len);
    return { value: decoder.decode(textBytes), bytesRead: bytesUsed + len };
  }
  if (major === 4) {
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
  if (major === 5) {
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
  if (major === 7) {
    if (additional === 20) return { value: false, bytesRead: 1 };
    if (additional === 21) return { value: true, bytesRead: 1 };
    if (additional === 22) return { value: null, bytesRead: 1 };
    throw new Error(`Unsupported CBOR simple value: ${additional}`);
  }
  throw new Error(`Unsupported CBOR major type: ${major}`);
}

async function importCOSEPublicKey(coseKeyBytes: Uint8Array): Promise<CryptoKey> {
  const { value: coseMap } = decodeCBOR(coseKeyBytes);
  const x = coseMap.get(-2) as Uint8Array;
  const y = coseMap.get(-3) as Uint8Array;
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

async function verifySignature(publicKey: CryptoKey, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  const rawSig = derToRaw(signature);
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    toArrayBuffer(rawSig),
    toArrayBuffer(data)
  );
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30) throw new Error("Invalid DER signature");
  let offset = 2;
  if (der[offset] !== 0x02) throw new Error("Invalid DER");
  const rLen = der[offset + 1];
  offset += 2;
  let r = der.slice(offset, offset + rLen);
  offset += rLen;
  if (der[offset] !== 0x02) throw new Error("Invalid DER");
  const sLen = der[offset + 1];
  offset += 2;
  let s = der.slice(offset, offset + sLen);
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

    if (action === "register-options") {
      const user = await getUserFromAuth(req);
      if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

      const rpId = getRequestRpId(req);
      const origin = getRequestOrigin(req);
      const db = getServiceClient();
      const { data: existing } = await db.from("passkey_credentials").select("credential_id").eq("user_id", user.id);
      const excludeCredentials = (existing || []).map((c: any) => ({
        id: c.credential_id,
        type: "public-key",
      }));

      const challenge = randomChallenge();
      const challengeToken = await createChallengeToken({
        action: "register",
        challenge,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
        origin,
        rpId,
        userId: user.id,
      });

      return jsonResponse({
        challenge,
        challengeToken,
        rp: { name: RP_NAME, id: rpId },
        user: {
          id: base64urlEncode(encoder.encode(user.id)),
          name: user.email,
          displayName: user.email.split("@")[0],
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
        excludeCredentials,
      });
    }

    if (action === "register-verify") {
      const user = await getUserFromAuth(req);
      if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

      const body = await req.json();
      const { credential, deviceName, challengeToken } = body;
      const challengeData = await verifyChallengeToken(challengeToken);

      if (!challengeData || challengeData.action !== "register" || challengeData.userId !== user.id) {
        return jsonResponse({ error: "Challenge expired" }, 400);
      }

      const clientDataJSON = base64urlDecode(credential.response.clientDataJSON);
      const clientData = JSON.parse(decoder.decode(clientDataJSON));

      if (clientData.challenge !== challengeData.challenge) {
        return jsonResponse({ error: "Challenge mismatch" }, 400);
      }
      if (clientData.type !== "webauthn.create") {
        return jsonResponse({ error: "Invalid type" }, 400);
      }
      if (clientData.origin !== challengeData.origin) {
        return jsonResponse({ error: "Origin mismatch" }, 400);
      }

      const attestationObject = base64urlDecode(credential.response.attestationObject);
      const { value: attObj } = decodeCBOR(attestationObject);
      const authData = attObj.get("authData") as Uint8Array;

      if (!(await matchesRpIdHash(authData, challengeData.rpId))) {
        return jsonResponse({ error: "RP ID mismatch" }, 400);
      }

      const counter = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
      let offset = 37;
      offset += 16;
      const credIdLen = (authData[offset] << 8) | authData[offset + 1];
      offset += 2;
      const credentialIdBytes = authData.slice(offset, offset + credIdLen);
      offset += credIdLen;
      const publicKeyBytes = authData.slice(offset);

      const credentialId = base64urlEncode(credentialIdBytes);
      const publicKey = base64urlEncode(publicKeyBytes);

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
        return jsonResponse({ error: "Failed to store credential" }, 500);
      }

      return jsonResponse({ success: true });
    }

    if (action === "auth-options") {
      const body = await req.json().catch(() => ({}));
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
      const rpId = getRequestRpId(req);
      const origin = getRequestOrigin(req);
      const challenge = randomChallenge();
      const challengeToken = await createChallengeToken({
        action: "auth",
        challenge,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
        origin,
        rpId,
      });

      const db = getServiceClient();
      let allowCredentials: any[] = [];

      if (email) {
        const { data: userData } = await db.auth.admin.listUsers();
        const matchedUser = userData?.users?.find((u: any) => u.email?.toLowerCase() === email);
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
        challengeToken,
        rpId,
        timeout: 60000,
        userVerification: "required",
      };

      if (allowCredentials.length > 0) {
        options.allowCredentials = allowCredentials;
      }

      return jsonResponse(options);
    }

    if (action === "auth-verify") {
      const body = await req.json();
      const { credential, challengeToken } = body;
      const challengeData = await verifyChallengeToken(challengeToken);

      if (!challengeData || challengeData.action !== "auth") {
        return jsonResponse({ error: "Challenge expired" }, 400);
      }

      const credentialId = credential.id;
      const db = getServiceClient();
      const { data: credData, error: credErr } = await db.from("passkey_credentials")
        .select("*")
        .eq("credential_id", credentialId)
        .single();

      if (credErr || !credData) {
        return jsonResponse({ error: "Unknown credential" }, 400);
      }

      const clientDataJSON = base64urlDecode(credential.response.clientDataJSON);
      const clientData = JSON.parse(decoder.decode(clientDataJSON));

      if (clientData.challenge !== challengeData.challenge) {
        return jsonResponse({ error: "Challenge mismatch" }, 400);
      }
      if (clientData.type !== "webauthn.get") {
        return jsonResponse({ error: "Invalid type" }, 400);
      }
      if (clientData.origin !== challengeData.origin) {
        return jsonResponse({ error: "Origin mismatch" }, 400);
      }

      const authData = base64urlDecode(credential.response.authenticatorData);
      if (!(await matchesRpIdHash(authData, challengeData.rpId))) {
        return jsonResponse({ error: "RP ID mismatch" }, 400);
      }

      const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(clientDataJSON)));
      const signedData = new Uint8Array(authData.length + clientDataHash.length);
      signedData.set(authData, 0);
      signedData.set(clientDataHash, authData.length);

      const publicKeyBytes = base64urlDecode(credData.public_key);
      const publicKey = await importCOSEPublicKey(publicKeyBytes);
      const signature = base64urlDecode(credential.response.signature);
      const valid = await verifySignature(publicKey, signature, signedData);

      if (!valid) {
        return jsonResponse({ error: "Invalid signature" }, 400);
      }

      const newCounter = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
      if (newCounter > 0 && newCounter <= credData.counter) {
        return jsonResponse({ error: "Possible cloned authenticator" }, 400);
      }
      await db.from("passkey_credentials").update({ counter: newCounter }).eq("id", credData.id);

      const { data: userData } = await db.auth.admin.getUserById(credData.user_id);
      if (!userData?.user?.email) {
        return jsonResponse({ error: "User not found" }, 400);
      }

      const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
        type: "magiclink",
        email: userData.user.email,
        options: { redirectTo: challengeData.origin },
      });

      if (linkErr || !linkData) {
        return jsonResponse({ error: "Failed to create session" }, 500);
      }

      const token_hash = linkData.properties?.hashed_token;
      const { data: sessionData, error: sessionErr } = await db.auth.verifyOtp({
        type: "magiclink",
        token_hash: token_hash!,
      });

      if (sessionErr || !sessionData?.session) {
        return jsonResponse({ error: "Failed to create session" }, 500);
      }

      return jsonResponse({
        success: true,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("WebAuthn error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});