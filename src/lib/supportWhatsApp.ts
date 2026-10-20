/** Pure helpers for WhatsApp replies from the admin inbox (no network/DB). */
export type SendOutcome =
  | { outcome: "accepted"; waId: string }
  | { outcome: "failed"; error: string }
  | { outcome: "unknown"; error: string };

/**
 * Only a 2xx with messages[0].id counts as accepted. A clear 4xx rejection is
 * "failed". Network errors, timeouts, 5xx or unreadable bodies are "unknown":
 * Meta may have delivered, so we never blindly retry.
 */
export function classifySendResult(status: number | null, bodyText: string | null): SendOutcome {
  if (status === null) return { outcome: "unknown", error: "Geen antwoord van WhatsApp (netwerk/timeout)" };
  if (status >= 200 && status < 300) {
    try {
      const id = (JSON.parse(bodyText ?? "") as { messages?: { id?: unknown }[] }).messages?.[0]?.id;
      if (typeof id === "string" && id.length > 0) return { outcome: "accepted", waId: id };
    } catch { /* fall through */ }
    return { outcome: "unknown", error: "Onduidelijk antwoord van WhatsApp" };
  }
  if (status >= 400 && status < 500) {
    let detail = "";
    try {
      const err = (JSON.parse(bodyText ?? "") as { error?: { code?: unknown; message?: unknown } }).error;
      detail = [err?.code, typeof err?.message === "string" ? err.message.slice(0, 160) : ""].filter(Boolean).join(" ");
    } catch { /* ignore */ }
    return { outcome: "failed", error: `Geweigerd (${status})${detail ? ": " + detail : ""}` };
  }
  return { outcome: "unknown", error: `WhatsApp-storing (${status}); niet automatisch opnieuw verstuurd` };
}

export const WA_STATUS_LABELS: Record<string, string> = {
  pending: "Bezig met versturen",
  queued: "Geaccepteerd door WhatsApp",
  sent: "Verzonden",
  delivered: "Afgeleverd",
  read: "Gelezen",
  failed: "Mislukt",
  unknown: "Onbekend — niet automatisch opnieuw verstuurd",
};

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  nieuw: "Nieuw",
  in_behandeling: "In behandeling",
  wacht_op_lid: "Wacht op lid",
  afgerond: "Afgerond",
};

export const ATTACHMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
};
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 3;

export function validateAttachment(file: { type: string; size: number; name: string }): string | null {
  if (!ATTACHMENT_TYPES[file.type]) return `${file.name}: alleen PDF, JPG of PNG`;
  if (file.size <= 0) return `${file.name}: leeg bestand`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name}: groter dan 10 MB`;
  return null;
}

export type SupportRpc = (n: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Reserve = { message_id: string; existing: boolean; state: string | null; phone?: string; body?: string };

/**
 * Reserve once (24h window + dedup in DB), POST at most once, record the outcome.
 * Existing reservations (incl. unknown/failed) never trigger another POST.
 */
export async function runSupportWhatsAppReply(
  data: { threadId: string; body: string; clientKey: string },
  rpc: SupportRpc,
  env: { lovableKey?: string; waKey?: string },
  fetchFn: typeof fetch,
) {
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
  if (!env.lovableKey || !env.waKey) {
    await rpc("support_wa_finish_reply", { p_message: r.message_id, p_outcome: "failed", p_wa_id: null, p_error: "Niet geconfigureerd" });
    return { state: "failed" as const, error: "WhatsApp is niet geconfigureerd" };
  }
  let status: number | null = null;
  let text: string | null = null;
  try {
    const res = await fetchFn("https://connector-gateway.lovable.dev/whatsapp/messages", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${env.lovableKey}`, "X-Connection-Api-Key": env.waKey, "Content-Type": "application/json" },
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
  return result.outcome === "accepted" ? { state: "queued" as const } : { state: result.outcome, error: result.error };
}
