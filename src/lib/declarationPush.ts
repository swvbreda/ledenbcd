/**
 * Push bij ingediende declaratie. Ontvanger komt uitsluitend uit de database-melding
 * (trigger, vaste goedkeurders), nooit uit de client. Lockscreen-tekst bevat geen
 * bedragen, namen of omschrijving; alleen het declaratie-id zit in de route.
 *
 * Bezorging is at-most-once per lease, geen exactly-once: een APNs-aanroep zonder
 * antwoord (netwerkfout/timeout) of een mislukte afronding wordt 'unknown' en nooit
 * automatisch opnieuw verstuurd. Alleen aantoonbaar geweigerde pushes ('failed') krijgen
 * een begrensde retry via de database-claim.
 */
import type { SendResult } from "@/lib/taskPush";

export const DECL_PUSH_TITLE = "Declaratie";
export const DECL_PUSH_BODY = "Er staat een declaratie klaar om te beoordelen";
export const DECL_BATCH_LIMIT = 10;

export type DeclClaim = { id: string; recipient_id: string; declaration_id: string; push_attempts: number; lock_token: string };
export type DeclFinalStatus = "sent" | "no_devices" | "failed" | "skipped" | "unknown";

export interface DeclarationPushPort {
  /** Database-claim met lease (declaration_push_claim); leeg als uit. */
  claim(limit: number, declarationId?: string): Promise<DeclClaim[]>;
  recipients(): Promise<string[]>;
  currentDeclaration(id: string): Promise<{ status: string; year: number } | null>;
  deviceTokens(userId: string): Promise<string[]>;
  /** true = afgerond; false = lease verlopen/ongeldig (stale). Gooit bij databasefout. */
  finish(c: DeclClaim, r: { status: DeclFinalStatus; sent: number; total: number; error: string | null }): Promise<boolean>;
  removeInvalidTokens(userId: string, tokens: string[]): Promise<void>;
}

export type DeclOutcome = DeclFinalStatus | "stale" | "finish_error";
type Sender = (token: string, payload: { title: string; body: string; route: string }) => Promise<SendResult>;

export function declarationRoute(id: string, year?: number) {
  const p = new URLSearchParams({ tab: "intern" });
  if (year) p.set("year", String(year));
  p.set("declaratie", id);
  return `/financien?${p.toString()}`;
}

const INVALID = ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"];
const msg = (e: unknown, n = 120) => (e instanceof Error ? e.message.slice(0, n) : "onbekende fout");

async function decide(db: DeclarationPushPort, send: Sender, c: DeclClaim) {
  // Fouten vóór enige verzending zijn definitief niet-afgeleverd -> 'failed' (retry toegestaan).
  let decl: { status: string; year: number } | null; let recips: string[]; let tokens: string[];
  try {
    decl = await db.currentDeclaration(c.declaration_id);
    recips = await db.recipients();
    if (!recips.includes(c.recipient_id)) return { status: "skipped" as const, sent: 0, total: 0, error: "Ontvanger is geen bevoegde goedkeurder" };
    if (!decl || decl.status !== "pending") return { status: "skipped" as const, sent: 0, total: 0, error: "Declaratie staat niet meer ter goedkeuring" };
    tokens = [...new Set(await db.deviceTokens(c.recipient_id))];
  } catch (e) {
    return { status: "failed" as const, sent: 0, total: 0, error: msg(e, 300) };
  }
  if (tokens.length === 0) return { status: "no_devices" as const, sent: 0, total: 0, error: null };
  let sent = 0, unknown = 0;
  const invalid: string[] = [], errors: string[] = [];
  const route = declarationRoute(c.declaration_id, decl.year);
  for (const t of tokens) {
    try {
      const r = await send(t, { title: DECL_PUSH_TITLE, body: DECL_PUSH_BODY, route });
      if (r.ok) sent++;
      else {
        errors.push(`${r.status}${r.reason ? " " + r.reason : ""}`);
        if (r.status === 410 || INVALID.includes(r.reason ?? "")) invalid.push(t);
      }
    } catch (e) {
      unknown++;
      errors.push(`onbekend: ${msg(e)}`);
    }
  }
  if (invalid.length) {
    try { await db.removeInvalidTokens(c.recipient_id, invalid); }
    catch (e) { errors.push(`opruimen mislukt: ${msg(e)}`); }
  }
  const valid = tokens.length - invalid.length;
  const status: DeclFinalStatus = sent > 0 ? "sent" : unknown > 0 ? "unknown" : valid === 0 ? "no_devices" : "failed";
  return { status, sent, total: tokens.length, error: errors.length ? errors.join("; ").slice(0, 500) : null };
}

export async function processDeclarationClaim(db: DeclarationPushPort, send: Sender, c: DeclClaim): Promise<{ id: string; outcome: DeclOutcome }> {
  const result = await decide(db, send, c);
  try {
    // Mislukte afronding: lease verloopt en de database zet hem op 'unknown' (geen blinde herhaling).
    return { id: c.id, outcome: (await db.finish(c, result)) ? result.status : "stale" };
  } catch {
    return { id: c.id, outcome: "finish_error" };
  }
}

/** Gedeelde, begrensde worker voor handmatige (na indienen) en geplande aanroep. */
export async function runDeclarationPushBatch(db: DeclarationPushPort, send: Sender, declarationId?: string, limit = DECL_BATCH_LIMIT) {
  const claims = await db.claim(limit, declarationId);
  const results: { id: string; outcome: DeclOutcome }[] = [];
  for (const c of claims) results.push(await processDeclarationClaim(db, send, c));
  return { processed: results.length, results };
}
