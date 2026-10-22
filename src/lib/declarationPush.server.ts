import { timingSafeEqual } from "node:crypto";
import { runDeclarationPushBatch, type DeclarationPushPort } from "@/lib/declarationPush";

/** Service-role poort; alle statusovergangen lopen via de database-RPC's met lease. */
export async function declarationPushPort(): Promise<DeclarationPushPort> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  return {
    async claim(limit, declarationId) {
      const { data, error } = await db.rpc("declaration_push_claim", { _limit: limit, _declaration: declarationId ?? null });
      if (error) throw new Error("Meldingen konden niet worden geclaimd");
      return data ?? [];
    },
    async recipients() {
      const { data, error } = await db.rpc("declaration_push_recipients");
      if (error) throw new Error("Goedkeurders konden niet worden gelezen");
      return (data ?? []) as string[];
    },
    async currentDeclaration(id) {
      const { data, error } = await db.from("internal_declarations").select("status,year").eq("id", id).maybeSingle();
      if (error) throw new Error("Declaratie kon niet worden gelezen");
      return data ?? null;
    },
    async deviceTokens(uid) {
      const { data, error } = await db.from("push_device_tokens").select("device_token").eq("user_id", uid).eq("platform", "ios");
      if (error) throw new Error("Apparaten konden niet worden gelezen");
      return (data ?? []).map((x: { device_token: string }) => x.device_token);
    },
    async finish(c, r) {
      const { data, error } = await db.rpc("declaration_push_finish", {
        _id: c.id, _lock: c.lock_token, _status: r.status, _sent: r.sent, _total: r.total, _error: r.error,
      });
      if (error) throw new Error("Afronden mislukt");
      return data === true;
    },
    async removeInvalidTokens(uid, tokens) {
      const { error } = await db.from("push_device_tokens").delete().eq("user_id", uid).in("device_token", tokens);
      if (error) throw new Error("Opruimen mislukt");
    },
  };
}

export async function runDeclarationPushes(env: Record<string, string | undefined>, port: DeclarationPushPort, declarationId?: string) {
  const { makeApnsSender } = await import("@/lib/apns.server");
  const sender = await makeApnsSender(env);
  // Zonder APNs-configuratie is er aantoonbaar niets verstuurd -> 'failed' (begrensde retry).
  const send = sender ?? (async () => ({ ok: false, status: 0, reason: "APNs niet ingesteld" }));
  return runDeclarationPushBatch(port, send, declarationId);
}

/** Interne geplande aanroep (wekker); caller wordt geverifieerd vóór privileged imports. */
export async function handleDeclarationPushSchedule(request: Request, env: Record<string, string | undefined>, load: () => Promise<DeclarationPushPort>) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const secret = env["INTERNAL_WEBHOOK_SECRET"]; const provided = request.headers.get("x-internal-secret");
  if (!secret || !provided || Buffer.byteLength(secret) !== Buffer.byteLength(provided) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))) return new Response(null, { status: 401 });
  try {
    const r = await runDeclarationPushes(env, await load());
    return Response.json({ processed: r.processed });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
