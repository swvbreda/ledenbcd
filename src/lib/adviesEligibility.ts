/**
 * Eenmalige, PKCE-beveiligde ledencontrole voor adviespakketten van Het Strategiebureau.
 * Pure logica (Web Crypto + geïnjecteerde opslag) zodat het te testen is zonder database.
 * Er verlaat nooit e-mail, contactgegevens, ledenlijst of token deze module: alleen
 * een willekeurige code (uitgifte) of een boolean `eligible` (inwisselen).
 */

/** Exacte origins van het bureau (zonder pad/slash). Leeg = alles geweigerd (fail-closed). */
export const ADVIES_AUDIENCES: readonly string[] = [];

export const CODE_TTL_SECONDS = 60;
export const ISSUE_LIMIT = { max: 10, windowSeconds: 600 } as const;
export const REDEEM_LIMIT = { max: 30, windowSeconds: 600 } as const;

const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/;
const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/;
const CODE_RE = /^[A-Za-z0-9_-]{43}$/;

export const isValidChallenge = (v: unknown): v is string => typeof v === "string" && CHALLENGE_RE.test(v);
export const isValidVerifier = (v: unknown): v is string => typeof v === "string" && VERIFIER_RE.test(v);
export const isValidState = (v: unknown): v is string => typeof v === "string" && STATE_RE.test(v);
export const isValidCode = (v: unknown): v is string => typeof v === "string" && CODE_RE.test(v);

/** Alleen exacte https-origin uit de allowlist; geen prefix/suffix/pad-varianten. */
export function isAllowedAudience(origin: unknown, allowed: readonly string[] = ADVIES_AUDIENCES): origin is string {
  if (typeof origin !== "string" || !allowed.includes(origin)) return false;
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && u.origin === origin;
  } catch {
    return false;
  }
}

export function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Bytes(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

export async function sha256Hex(text: string): Promise<string> {
  return [...(await sha256Bytes(text))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** RFC 7636 S256: BASE64URL(SHA256(ASCII(verifier))). */
export async function s256Challenge(verifier: string): Promise<string> {
  return base64Url(await sha256Bytes(verifier));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export interface EligibilityStore {
  rateLimit(kind: "issue" | "redeem", subjectHash: string, max: number, windowSeconds: number): Promise<boolean>;
  isCurrentMember(userId: string): Promise<boolean>;
  insertCode(row: { codeHash: string; challenge: string; audience: string; userId: string; expiresAt: Date }): Promise<void>;
  /** Atomair: retourneert de rij precies één keer (ongebruikt, niet verlopen, juiste audience). */
  consumeCode(codeHash: string, audience: string): Promise<{ userId: string; challenge: string } | null>;
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; reason: "invalid_request" | "rate_limited" | "not_eligible" };

export async function issueEligibilityCode(
  store: EligibilityStore,
  input: { userId: string; challenge: unknown; method: unknown; audience: unknown },
  opts: { allowed?: readonly string[]; now?: Date } = {},
): Promise<IssueResult> {
  if (input.method !== "S256" || !isValidChallenge(input.challenge) || !isAllowedAudience(input.audience, opts.allowed)) {
    return { ok: false, reason: "invalid_request" };
  }
  if (!(await store.rateLimit("issue", await sha256Hex(`user:${input.userId}`), ISSUE_LIMIT.max, ISSUE_LIMIT.windowSeconds))) {
    return { ok: false, reason: "rate_limited" };
  }
  if (!(await store.isCurrentMember(input.userId))) return { ok: false, reason: "not_eligible" };
  const code = randomCode();
  const now = opts.now ?? new Date();
  await store.insertCode({
    codeHash: await sha256Hex(code),
    challenge: input.challenge,
    audience: input.audience,
    userId: input.userId,
    expiresAt: new Date(now.getTime() + CODE_TTL_SECONDS * 1000),
  });
  return { ok: true, code };
}

export type RedeemResult = { status: 200 | 400 | 429; body: { eligible: boolean } };

/** Elke fout geeft hetzelfde `{eligible:false}`; een code wordt bij de eerste poging verbrand. */
export async function redeemEligibilityCode(
  store: EligibilityStore,
  input: { code: unknown; verifier: unknown; audience: unknown; clientKey: string },
  opts: { allowed?: readonly string[] } = {},
): Promise<RedeemResult> {
  const no = (status: 200 | 400 | 429 = 200): RedeemResult => ({ status, body: { eligible: false } });
  if (!isAllowedAudience(input.audience, opts.allowed)) return no(400);
  if (!(await store.rateLimit("redeem", await sha256Hex(`client:${input.clientKey}`), REDEEM_LIMIT.max, REDEEM_LIMIT.windowSeconds))) {
    return no(429);
  }
  if (!isValidCode(input.code) || !isValidVerifier(input.verifier)) return no(400);
  const row = await store.consumeCode(await sha256Hex(input.code), input.audience);
  if (!row) return no();
  if (!timingSafeEqual(await s256Challenge(input.verifier), row.challenge)) return no();
  return { status: 200, body: { eligible: await store.isCurrentMember(row.userId) } };
}
