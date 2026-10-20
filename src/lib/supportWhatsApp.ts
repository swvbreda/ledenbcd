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
