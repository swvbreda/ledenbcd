/**
 * Downloads forwarded WhatsApp attachments (jpg/png/pdf, max 20 MB) for
 * explicitly allowed publishers and publishes them only once fully stored.
 * Any failure keeps the message out of Aankondigingen (inbox only).
 */
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const GATEWAY = "https://connector-gateway.lovable.dev/whatsapp";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };

export interface MediaClaim { wa_message_id: string; media_id: string | null; media_mime: string | null }
export interface MediaDeps {
  fetch: typeof fetch;
  headers: Record<string, string>;
  upload: (path: string, bytes: Uint8Array, mime: string) => Promise<void>;
  complete: (id: string, path: string, sha: string, size: number, mime: string) => Promise<void>;
  fail: (id: string, error: string, final: boolean) => Promise<void>;
}

export async function readLimited(body: ReadableStream<Uint8Array> | null, limit: number): Promise<Uint8Array> {
  if (!body) throw new Error("empty_body");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new Error("too_large"); }
    chunks.push(value);
  }
  if (total === 0) throw new Error("empty_body");
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function processAttachment(claim: MediaClaim, deps: MediaDeps): Promise<void> {
  const id = claim.wa_message_id;
  const mime = claim.media_mime ?? "";
  if (!claim.media_id || !/^[A-Za-z0-9_-]{1,200}$/.test(claim.media_id) || !EXT[mime]) {
    await deps.fail(id, "unsupported_media", true);
    return;
  }
  try {
    const metaRes = await deps.fetch(`${GATEWAY}/media/${claim.media_id}`, { headers: deps.headers });
    if (!metaRes.ok) throw new Error(`meta_${metaRes.status}`);
    const meta = (await metaRes.json()) as { url?: unknown; file_size?: unknown; mime_type?: unknown };
    if (typeof meta.url !== "string" || !meta.url.startsWith("https://")) throw new Error("meta_url");
    if (typeof meta.file_size === "number" && meta.file_size > MAX_MEDIA_BYTES) {
      await deps.fail(id, "too_large", true);
      return;
    }
    const fileRes = await deps.fetch(`${GATEWAY}/media_download`, {
      headers: { ...deps.headers, "X-WhatsApp-Media-URL": meta.url },
    });
    if (!fileRes.ok) throw new Error(`download_${fileRes.status}`);
    const bytes = await readLimited(fileRes.body, MAX_MEDIA_BYTES);
    const sha = await sha256Hex(bytes);
    const path = `${id.replace(/[^A-Za-z0-9_.=-]/g, "_").slice(0, 200)}/${sha}.${EXT[mime]}`;
    await deps.upload(path, bytes, mime);
    await deps.complete(id, path, sha, bytes.byteLength, mime);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown";
    await deps.fail(id, msg, msg === "too_large");
  }
}
