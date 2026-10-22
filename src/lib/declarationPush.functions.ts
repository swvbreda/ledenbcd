import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DECL_MAX_ATTEMPTS, DECL_STALE_SENDING_MS, processDeclarationNotification, type DeclarationPushPort } from "@/lib/declarationPush";

/**
 * Verstuurt openstaande pushes voor één declaratie. Alleen de indiener of een beheerder
 * mag dit aanroepen; ontvangers komen uit de database-melding. Standaard uit.
 */
export const dispatchDeclarationPushes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ declarationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) {
      const { data: own } = await sb.from("internal_declarations").select("id").eq("id", data.declarationId).eq("submitted_by", context.userId).maybeSingle();
      if (!own) throw new Error("Geen toegang");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: settings } = await db.from("declaration_push_settings").select("enabled").eq("id", true).maybeSingle();
    if (settings?.enabled !== true) return { disabled: true, processed: 0 };

    const staleBefore = new Date(Date.now() - DECL_STALE_SENDING_MS).toISOString();
    const { data: rows, error } = await db.from("declaration_notifications").select("id")
      .eq("declaration_id", data.declarationId).lt("push_attempts", DECL_MAX_ATTEMPTS)
      .or(`push_status.in.(pending,failed),and(push_status.eq.sending,push_last_attempt_at.lt.${staleBefore})`)
      .order("created_at", { ascending: true }).limit(10);
    if (error) throw new Error("Meldingen konden niet worden gelezen");
    if (!rows?.length) return { disabled: false, processed: 0 };

    const { makeApnsSender } = await import("@/lib/apns.server");
    const sender = await makeApnsSender(process.env);
    const port: DeclarationPushPort = {
      async claim(id) {
        const { data: cur } = await db.from("declaration_notifications").select("id,recipient_id,declaration_id,push_attempts,push_status,push_last_attempt_at").eq("id", id).maybeSingle();
        if (!cur || cur.push_attempts >= DECL_MAX_ATTEMPTS) return null;
        const claimable = cur.push_status === "pending" || cur.push_status === "failed" ||
          (cur.push_status === "sending" && (!cur.push_last_attempt_at || cur.push_last_attempt_at < staleBefore));
        if (!claimable) return null;
        const { data: upd } = await db.from("declaration_notifications")
          .update({ push_status: "sending", push_attempts: cur.push_attempts + 1, push_last_attempt_at: new Date().toISOString() })
          .eq("id", id).eq("push_attempts", cur.push_attempts).eq("push_status", cur.push_status).select("id,recipient_id,declaration_id,push_attempts");
        return upd?.[0] ?? null;
      },
      async recipients() {
        const { data: r, error: e } = await db.rpc("declaration_push_recipients");
        if (e) throw new Error("Goedkeurders konden niet worden gelezen");
        return (r ?? []) as string[];
      },
      async currentDeclaration(id) {
        const { data: d } = await db.from("internal_declarations").select("status,year").eq("id", id).maybeSingle();
        return d ?? null;
      },
      async deviceTokens(uid) {
        const { data: t, error: e } = await db.from("push_device_tokens").select("device_token").eq("user_id", uid).eq("platform", "ios");
        if (e) throw new Error("Apparaten konden niet worden gelezen");
        return (t ?? []).map((x: { device_token: string }) => x.device_token);
      },
      async finish(id, r) {
        await db.from("declaration_notifications").update({ push_status: r.status, push_sent: r.sent, push_total: r.total, push_error: r.error }).eq("id", id);
      },
      async removeInvalidTokens(uid, tokens) {
        await db.from("push_device_tokens").delete().eq("user_id", uid).in("device_token", tokens);
      },
    };
    const send = sender ?? (async () => ({ ok: false, status: 0, reason: "APNs niet ingesteld" }));
    let processed = 0;
    for (const r of rows) { await processDeclarationNotification(port, send, r.id); processed++; }
    return { disabled: false, processed };
  });
