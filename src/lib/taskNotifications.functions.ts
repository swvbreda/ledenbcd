import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_PUSH_ATTEMPTS, STALE_SENDING_MS, processTaskNotification, type TaskPushPort } from "@/lib/taskPush";

/**
 * Verwerkt openstaande taakpushes. Alleen beheerders mogen dit aanroepen;
 * de ontvanger komt altijd uit de database-melding (trigger), nooit uit de input.
 */
export const dispatchTaskPushes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr || isAdmin !== true) throw new Error("Geen toegang: alleen beheerders.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { makeApnsSender } = await import("@/lib/apns.server");
    const db = supabaseAdmin as any;

    const staleBefore = new Date(Date.now() - STALE_SENDING_MS).toISOString();
    let q = db.from("task_notifications").select("id")
      .lt("push_attempts", MAX_PUSH_ATTEMPTS)
      .or(`push_status.in.(pending,failed),and(push_status.eq.sending,push_last_attempt_at.lt.${staleBefore})`)
      .order("created_at", { ascending: true }).limit(20);
    if (data.taskId) q = q.eq("task_id", data.taskId);
    const { data: rows, error } = await q;
    if (error) throw new Error("Meldingen konden niet worden gelezen");
    if (!rows?.length) return { processed: 0, results: [] as { id: string; outcome: string }[] };

    const sender = await makeApnsSender(process.env);
    const port: TaskPushPort = {
      async claim(id) {
        const { data: cur } = await db.from("task_notifications").select("id,recipient_id,task_id,push_attempts,push_status,push_last_attempt_at").eq("id", id).maybeSingle();
        if (!cur || cur.push_attempts >= MAX_PUSH_ATTEMPTS) return null;
        const claimable = cur.push_status === "pending" || cur.push_status === "failed" ||
          (cur.push_status === "sending" && (!cur.push_last_attempt_at || cur.push_last_attempt_at < staleBefore));
        if (!claimable) return null;
        const { data: upd } = await db.from("task_notifications")
          .update({ push_status: "sending", push_attempts: cur.push_attempts + 1, push_last_attempt_at: new Date().toISOString() })
          .eq("id", id).eq("push_attempts", cur.push_attempts).eq("push_status", cur.push_status).select("id,recipient_id,task_id,push_attempts");
        return upd?.[0] ?? null;
      },
      async isAdmin(uid) {
        const { data: r } = await db.from("user_roles").select("user_id").eq("user_id", uid).eq("role", "admin").maybeSingle();
        return !!r;
      },
      async currentTask(id) {
        const { data: t } = await db.from("internal_tasks").select("assignee_id,status").eq("id", id).maybeSingle();
        return t ?? null;
      },
      async deviceTokens(uid) {
        const { data: t, error: e } = await db.from("push_device_tokens").select("device_token").eq("user_id", uid).eq("platform", "ios");
        if (e) throw new Error("Apparaten konden niet worden gelezen");
        return (t ?? []).map((x: { device_token: string }) => x.device_token);
      },
      async finish(id, r) {
        await db.from("task_notifications").update({ push_status: r.status, push_sent: r.sent, push_total: r.total, push_error: r.error }).eq("id", id);
      },
      async removeInvalidTokens(uid, tokens) {
        await db.from("push_device_tokens").delete().eq("user_id", uid).in("device_token", tokens);
      },
    };
    const send = sender ?? (async () => ({ ok: false, status: 0, reason: "APNs niet ingesteld" }));
    const results = [];
    for (const r of rows) results.push(await processTaskNotification(port, send, r.id));
    return { processed: results.length, results };
  });

/** Alleen-lezen bezorgstatus voor beheerders: booleans en aantallen, nooit geheime waarden. */
export const taskPushStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr || isAdmin !== true) throw new Error("Geen toegang: alleen beheerders.");
    const { makeApnsSender } = await import("@/lib/apns.server");
    let configured = false;
    let keyValid = false;
    let configError: string | null = null;
    try {
      configured = !!(process.env["APNS_KEY_ID"] && process.env["APNS_TEAM_ID"] && process.env["APNS_PRIVATE_KEY"]);
      if (configured) keyValid = !!(await makeApnsSender(process.env)); // lokaal ondertekenen, geen netwerk
    } catch {
      configError = "APNs-sleutel kon niet worden gelezen";
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const count = async (statuses: string[]) => {
      const { count: c } = await db.from("task_notifications").select("id", { count: "exact", head: true }).in("push_status", statuses);
      return c ?? 0;
    };
    return {
      configured, keyValid, configError,
      queued: await count(["pending", "sending"]),
      failed: await count(["failed"]),
      noDevices: await count(["no_devices"]),
      sent: await count(["sent"]),
      skipped: await count(["skipped"]),
    };
  });
