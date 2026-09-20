/**
 * Pure helpers voor de WhatsApp Cloud API webhook.
 * Bevat geen netwerk- of databasecode zodat dit los getest kan worden.
 */

export interface ParsedWhatsAppMessage {
  waMessageId: string;
  waId: string;
  profileName: string | null;
  messageType: string;
  body: string | null;
  mediaId: string | null;
  mediaMimeType: string | null;
  sentAt: string | null;
}

/** Vergelijking zonder vroegtijdige exit, om timinglekken te beperken. */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verificatie van de GET-handshake van Meta. */
export function verifyChallenge(
  params: URLSearchParams,
  verifyToken: string | undefined,
): { ok: boolean; challenge?: string } {
  if (!verifyToken) return { ok: false };
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !challenge) return { ok: false };
  if (!timingSafeEqualString(token ?? "", verifyToken)) return { ok: false };
  return { ok: true, challenge };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Controleert de X-Hub-Signature-256 header. Faalt gesloten bij een ontbrekend
 * secret of een ontbrekende/onjuist opgemaakte handtekening.
 */
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined,
): Promise<boolean> {
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  return timingSafeEqualString(toHex(mac), provided);
}

const TEXT_LIMIT = 4000;

function clip(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, TEXT_LIMIT);
}

function epochToIso(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"] as const;

/**
 * Haalt inkomende 1-op-1 berichten uit een Meta-webhookpayload.
 * Onbekende typen blijven herkenbaar bewaard zonder te crashen.
 */
export function parseIncomingMessages(payload: unknown): ParsedWhatsAppMessage[] {
  const result: ParsedWhatsAppMessage[] = [];
  const entries = Array.isArray((payload as { entry?: unknown })?.entry)
    ? ((payload as { entry: unknown[] }).entry)
    : [];

  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown })?.changes)
      ? (entry as { changes: unknown[] }).changes
      : [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) continue;
      const messages = Array.isArray(value["messages"])
        ? (value["messages"] as Record<string, unknown>[])
        : [];
      const contacts = Array.isArray(value["contacts"])
        ? (value["contacts"] as Record<string, unknown>[])
        : [];

      const nameByWaId = new Map<string, string>();
      for (const contact of contacts) {
        const waId = typeof contact["wa_id"] === "string" ? contact["wa_id"] : null;
        const profile = contact["profile"] as { name?: unknown } | undefined;
        const name = clip(profile?.name);
        if (waId && name) nameByWaId.set(waId, name);
      }

      for (const message of messages) {
        const waMessageId = typeof message["id"] === "string" ? message["id"] : null;
        const waId = typeof message["from"] === "string" ? message["from"] : null;
        if (!waMessageId || !waId) continue;

        const type = typeof message["type"] === "string" ? message["type"] : "unknown";
        let body: string | null = null;
        let mediaId: string | null = null;
        let mediaMimeType: string | null = null;

        if (type === "text") {
          body = clip((message["text"] as { body?: unknown } | undefined)?.body);
        } else if (type === "button") {
          body = clip((message["button"] as { text?: unknown } | undefined)?.text);
        } else if (type === "interactive") {
          const interactive = message["interactive"] as Record<string, unknown> | undefined;
          const reply = (interactive?.["button_reply"] ??
            interactive?.["list_reply"] ??
            interactive?.["nfm_reply"]) as Record<string, unknown> | undefined;
          body =
            clip(reply?.["title"]) ??
            clip(reply?.["description"]) ??
            clip(reply?.["body"]) ??
            clip(reply?.["id"]);
        } else if ((MEDIA_TYPES as readonly string[]).includes(type)) {
          const media = message[type] as Record<string, unknown> | undefined;
          body = clip(media?.["caption"]) ?? clip(media?.["filename"]);
          mediaId = typeof media?.["id"] === "string" ? (media["id"] as string) : null;
          mediaMimeType =
            typeof media?.["mime_type"] === "string"
              ? (media["mime_type"] as string)
              : null;
        }

        result.push({
          waMessageId,
          waId,
          profileName: nameByWaId.get(waId) ?? null,
          messageType: type,
          body,
          mediaId,
          mediaMimeType,
          sentAt: epochToIso(message["timestamp"]),
        });
      }
    }
  }

  return result;
}

/** Korte preview voor de gesprekkenlijst. */
export function previewFor(message: ParsedWhatsAppMessage): string {
  if (message.body) return message.body.slice(0, 140);
  if (message.messageType === "text") return "(leeg bericht)";
  return `(${message.messageType})`;
}

/** Afgeschermd telefoonnummer voor weergave en logging. */
export function maskWaId(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `••••${digits.slice(-4)}`;
}
