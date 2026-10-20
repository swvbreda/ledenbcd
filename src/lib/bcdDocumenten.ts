/**
 * Koppeling "Beleid en documenten" met de Beleidsmonitor (Coffeeshopbeleid).
 * Pure helpers: geen process.env, zodat alles met een nep-fetch testbaar is.
 * Contract v1 (voorlopig, aanpassen zodra de bron het bewezen contract levert):
 *   GET /api/public/bcd-documenten/v1/gemeenten          -> { gemeenten: [{gm_code, naam}] }
 *   GET /api/public/bcd-documenten/v1/documenten?gm_code=&cursor=&limit= -> { documenten: [...], volgende_cursor: string|null }
 */
import { plaatsToGemeente } from "@/data/gemeenteMapping";

export const DOC_HEADER = "x-bcd-documenten-sleutel";
export const DERIVE_LABEL = "bcd-public-documents:v1";
export const ALLOWED_SOURCE_HOSTS = ["coffeeshopbeleid.com"];
export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;
const MAX_BODY = 1024 * 1024;

export const GM_CODE = /^GM\d{4}$/;
export const CURSOR = /^[A-Za-z0-9_\-.=:]{1,200}$/;

export type BcdGemeente = { gm_code: string; naam: string };
export type BcdDocument = {
  id: string;
  titel: string;
  documentdatum: string | null;
  documentsoort: string | null;
  gemeente: BcdGemeente;
  bron_url: string;
};
export type FoutReden =
  | "geen_toegang" | "niet_geconfigureerd" | "bron_onbereikbaar"
  | "incompatibel" | "te_veel_verzoeken" | "ongeldige_invoer";
export type DocumentenResultaat =
  | { status: "ok"; gemeente: BcdGemeente; documenten: BcdDocument[]; volgende_cursor: string | null }
  | { status: "niet_gekoppeld" }
  | { status: "fout"; reden: FoutReden };

export class BronFout extends Error {
  constructor(public reden: FoutReden) { super(reden); }
}

/** Vaste bron-origin; alleen https en een bekende host, geen pad/credentials. */
export function sourceOrigin(raw: string | undefined): string {
  if (!raw) throw new BronFout("niet_geconfigureerd");
  let u: URL;
  try { u = new URL(raw); } catch { throw new BronFout("niet_geconfigureerd"); }
  if (u.protocol !== "https:" || u.username || u.password || !ALLOWED_SOURCE_HOSTS.includes(u.hostname)) {
    throw new BronFout("niet_geconfigureerd");
  }
  return u.origin;
}

/** HMAC-SHA256(basissleutel, label) als hex — de afgeleide, beperkte sleutel. */
export async function deriveDocumentKey(base: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(base), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(DERIVE_LABEL)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeGemeenteNaam(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/^gemeente\s+/, "").replace(/\s+/g, " ").trim();
}

/** Exacte koppeling naam -> gm_code (via officiële plaats→gemeente-mapping); ambigu/onbekend = null. */
export function resolveGmCode(naam: string, lijst: BcdGemeente[]): BcdGemeente | null {
  const trimmed = naam.trim();
  const canon = normalizeGemeenteNaam(plaatsToGemeente[trimmed] ?? trimmed);
  if (!canon) return null;
  const hits = lijst.filter((g) => normalizeGemeenteNaam(g.naam) === canon);
  return hits.length === 1 ? hits[0] : null;
}

function isPublicHttps(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const h = u.hostname;
    if (h === "localhost" || h.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return null;
    return u.toString();
  } catch { return null; }
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
const nullableStr = (v: unknown, max: number): string | null | undefined =>
  v === null ? null : typeof v === "string" && v.length <= max ? (v.trim() || null) : undefined;

function parseGemeente(v: unknown): BcdGemeente | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const gm = str(o.gm_code, 6), naam = str(o.naam, 120);
  return gm && GM_CODE.test(gm) && naam ? { gm_code: gm, naam } : null;
}

/** Strikte allowlist; vorm wijkt af -> incompatibel (nooit stil een lege lijst). */
export function parseGemeentenResponse(body: unknown): BcdGemeente[] {
  const arr = (body as { gemeenten?: unknown })?.gemeenten;
  if (!Array.isArray(arr) || arr.length > 1000) throw new BronFout("incompatibel");
  const out: BcdGemeente[] = [];
  for (const g of arr) {
    const p = parseGemeente(g);
    if (!p) throw new BronFout("incompatibel");
    out.push(p);
  }
  return out;
}

export function parseDocumentenResponse(body: unknown, gmCode: string): { documenten: BcdDocument[]; volgende_cursor: string | null } {
  const b = body as { documenten?: unknown; volgende_cursor?: unknown } | null;
  if (!b || !Array.isArray(b.documenten) || b.documenten.length > MAX_LIMIT) throw new BronFout("incompatibel");
  const cur = b.volgende_cursor;
  if (!(cur === null || (typeof cur === "string" && CURSOR.test(cur)))) throw new BronFout("incompatibel");
  const docs: BcdDocument[] = [];
  for (const raw of b.documenten) {
    if (!raw || typeof raw !== "object") throw new BronFout("incompatibel");
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "number" ? String(o.id) : str(o.id, 200);
    const titel = str(o.titel, 500);
    const datum = nullableStr(o.documentdatum, 40);
    const soort = nullableStr(o.documentsoort, 120);
    const gemeente = parseGemeente(o.gemeente);
    if (!id || !titel || datum === undefined || soort === undefined || !gemeente) throw new BronFout("incompatibel");
    if (gemeente.gm_code !== gmCode) continue; // nooit documenten van een andere gemeente tonen
    const url = isPublicHttps(o.bron_url);
    if (!url) continue; // alleen originele openbare https-bronnen
    const datumOk = datum && /^\d{4}-\d{2}-\d{2}/.test(datum) && !Number.isNaN(Date.parse(datum)) ? datum.slice(0, 10) : null;
    docs.push({ id, titel, documentdatum: datumOk, documentsoort: soort, gemeente, bron_url: url });
  }
  docs.sort((a, b) => (b.documentdatum ?? "").localeCompare(a.documentdatum ?? ""));
  return { documenten: docs, volgende_cursor: cur as string | null };
}

async function readJson(res: Response): Promise<unknown> {
  if (!(res.headers.get("content-type") ?? "").includes("application/json") || !res.body) {
    await res.body?.cancel();
    throw new BronFout("incompatibel");
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY) { await reader.cancel(); throw new BronFout("incompatibel"); }
    chunks.push(value);
  }
  try { return JSON.parse(new TextDecoder().decode(await new Blob(chunks as BlobPart[]).arrayBuffer())); }
  catch { throw new BronFout("incompatibel"); }
}

type Fetch = typeof fetch;

async function sourceGet(origin: string, path: string, key: string, fetchImpl: Fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(`${origin}${path}`, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json", [DOC_HEADER]: key },
    });
  } catch { throw new BronFout("bron_onbereikbaar"); }
  if (res.status === 401 || res.status === 403) { await res.body?.cancel(); throw new BronFout("niet_geconfigureerd"); }
  if (!res.ok) { await res.body?.cancel(); throw new BronFout("bron_onbereikbaar"); }
  return readJson(res);
}

export async function fetchGemeenten(origin: string, key: string, fetchImpl: Fetch = fetch) {
  return parseGemeentenResponse(await sourceGet(origin, "/api/public/bcd-documenten/v1/gemeenten", key, fetchImpl));
}

export async function fetchDocumenten(
  origin: string, key: string, gmCode: string, cursor: string | null, limit: number, fetchImpl: Fetch = fetch,
) {
  if (!GM_CODE.test(gmCode) || (cursor !== null && !CURSOR.test(cursor))) throw new BronFout("ongeldige_invoer");
  const q = new URLSearchParams({ gm_code: gmCode, limit: String(Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT)) });
  if (cursor) q.set("cursor", cursor);
  return parseDocumentenResponse(
    await sourceGet(origin, `/api/public/bcd-documenten/v1/documenten?${q}`, key, fetchImpl), gmCode,
  );
}
