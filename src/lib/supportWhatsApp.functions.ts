import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifySendResult } from "./supportWhatsApp";

const input = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  clientKey: z.string().uuid(),
});

type Reserve = { message_id: string; existing: boolean; state: string | null; phone?: string; body?: string };

/** Admin-only, explicit click: reserve once (24h window checked in DB), send once, record outcome. */
export const sendSupportWhatsAppReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as (
      n: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    const reserved = await rpc("support_wa_reserve_reply", {
      p_thread: data.threadId, p_body: data.body, p_client_key: data.clientKey,
    });
    if (reserved.error) {
      const m = reserved.error.message;
      if (m.includes("outside_window")) return { state: "outside_window" as const };
      if (m.includes("no_whatsapp_link")) return { state: "no_link" as const };
      if (m.includes("not authorized")) throw new Error("Geen toegang");
      throw new Error("Reserveren mislukt");
    }
    const r = reserved.data as Reserve;
    if (r.existing) return { state: (r.state ?? "unknown") as string, existing: true };

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const waKey = process.env["WHATSAPP_API_KEY"];
    let status: number | null = null;
    let text: string | null = null;
    if (!lovableKey || !waKey) {
      await rpc("support_wa_finish_reply", { p_message: r.message_id, p_outcome: "failed", p_wa_id: null, p_error: "Niet geconfigureerd" });
      return { state: "failed" as const, error: "WhatsApp is niet geconfigureerd" };
    }
    try {
      const res = await fetch("https://connector-gateway.lovable.dev/whatsapp/messages", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": waKey, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: r.phone, type: "text", text: { body: r.body } }),
      });
      status = res.status;
      text = await res.text().catch(() => null);
    } catch {
      status = null;
    }
    const result = classifySendResult(status, text);
    if (result.outcome !== "accepted") console.error(`[support-wa] send ${result.outcome} [${status ?? "none"}]`);
    const fin = await rpc("support_wa_finish_reply", {
      p_message: r.message_id, p_outcome: result.outcome,
      p_wa_id: result.outcome === "accepted" ? result.waId : null,
      p_error: result.outcome === "accepted" ? null : result.error,
    });
    if (fin.error) return { state: "unknown" as const, error: "Status kon niet worden vastgelegd" };
    return result.outcome === "accepted"
      ? { state: "queued" as const }
      : { state: result.outcome, error: result.error };
  });
