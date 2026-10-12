import type { SendResult } from "@/lib/taskPush";

function b64url(bytes: Uint8Array | string) {
  const s = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createApnsJwt(keyId: string, teamId: string, pem: string) {
  const input = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId }))}.${b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }))}`;
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input)));
  return `${input}.${b64url(sig)}`;
}

/** Bouwt een APNs-verzender uit server-secrets; null als niet ingesteld. */
export async function makeApnsSender(env: Record<string, string | undefined>) {
  const keyId = env["APNS_KEY_ID"], teamId = env["APNS_TEAM_ID"], pem = env["APNS_PRIVATE_KEY"];
  if (!keyId || !teamId || !pem) return null;
  const bundleId = env["APNS_BUNDLE_ID"] ?? "nl.coffeeshopbond.leden";
  const jwt = await createApnsJwt(keyId, teamId, pem);
  return async (token: string, p: { title: string; body: string; route: string }): Promise<SendResult> => {
    if (!/^[0-9a-fA-F]{32,200}$/.test(token)) return { ok: false, status: 400, reason: "BadDeviceToken" };
    const res = await fetch(`https://api.push.apple.com/3/device/${token}`, {
      method: "POST",
      headers: { authorization: `bearer ${jwt}`, "apns-topic": bundleId, "apns-push-type": "alert", "apns-priority": "10", "content-type": "application/json" },
      body: JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: "default", badge: 1 }, route: p.route }),
    });
    let reason: string | undefined;
    if (!res.ok) { try { reason = (JSON.parse(await res.text()) as { reason?: string }).reason; } catch { /* leeg */ } }
    return { ok: res.ok, status: res.status, reason };
  };
}
