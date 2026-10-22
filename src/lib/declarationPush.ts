/**
 * Push bij ingediende declaratie. Ontvanger komt uitsluitend uit de database-melding
 * (trigger, vaste goedkeurders), nooit uit de client. Lockscreen-tekst bevat geen
 * bedragen, namen of omschrijving; alleen het declaratie-id zit in de route.
 */
import type { SendResult } from "@/lib/taskPush";

export const DECL_PUSH_TITLE = "Declaratie";
export const DECL_PUSH_BODY = "Er staat een declaratie klaar om te beoordelen";
export const DECL_MAX_ATTEMPTS = 5;
export const DECL_STALE_SENDING_MS = 5 * 60_000;

export type DeclNotificationRow = { id: string; recipient_id: string; declaration_id: string; push_attempts: number };

export interface DeclarationPushPort {
  claim(id: string): Promise<DeclNotificationRow | null>;
  /** Vaste, actuele goedkeurderslijst (server). */
  recipients(): Promise<string[]>;
  currentDeclaration(id: string): Promise<{ status: string; year: number } | null>;
  deviceTokens(userId: string): Promise<string[]>;
  finish(id: string, r: { status: "sent" | "no_devices" | "failed" | "skipped"; sent: number; total: number; error: string | null }): Promise<void>;
  removeInvalidTokens(userId: string, tokens: string[]): Promise<void>;
}

export function declarationRoute(id: string, year?: number) {
  const p = new URLSearchParams({ tab: "intern" });
  if (year) p.set("year", String(year));
  p.set("declaratie", id);
  return `/financien?${p.toString()}`;
}

const INVALID = ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"];

export async function processDeclarationNotification(
  db: DeclarationPushPort,
  send: (token: string, payload: { title: string; body: string; route: string }) => Promise<SendResult>,
  id: string,
) {
  const n = await db.claim(id);
  if (!n) return { id, outcome: "not_claimed" as const };
  try {
    const decl = await db.currentDeclaration(n.declaration_id);
    if (!(await db.recipients()).includes(n.recipient_id)) {
      await db.finish(n.id, { status: "skipped", sent: 0, total: 0, error: "Ontvanger is geen bevoegde goedkeurder" });
      return { id, outcome: "skipped" as const };
    }
    if (!decl || decl.status !== "pending") {
      await db.finish(n.id, { status: "skipped", sent: 0, total: 0, error: "Declaratie staat niet meer ter goedkeuring" });
      return { id, outcome: "skipped" as const };
    }
    const tokens = [...new Set(await db.deviceTokens(n.recipient_id))];
    if (tokens.length === 0) {
      await db.finish(n.id, { status: "no_devices", sent: 0, total: 0, error: null });
      return { id, outcome: "no_devices" as const };
    }
    let sent = 0;
    const invalid: string[] = [];
    const errors: string[] = [];
    const route = declarationRoute(n.declaration_id, decl.year);
    for (const t of tokens) {
      try {
        const r = await send(t, { title: DECL_PUSH_TITLE, body: DECL_PUSH_BODY, route });
        if (r.ok) sent++;
        else {
          errors.push(`${r.status}${r.reason ? " " + r.reason : ""}`);
          if (r.status === 410 || INVALID.includes(r.reason ?? "")) invalid.push(t);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message.slice(0, 120) : "onbekende fout");
      }
    }
    if (invalid.length) await db.removeInvalidTokens(n.recipient_id, invalid);
    const valid = tokens.length - invalid.length;
    const status = sent > 0 ? "sent" : valid === 0 ? "no_devices" : "failed";
    await db.finish(n.id, { status, sent, total: tokens.length, error: errors.length ? errors.join("; ").slice(0, 500) : null });
    return { id, outcome: status };
  } catch (e) {
    await db.finish(n.id, { status: "failed", sent: 0, total: 0, error: e instanceof Error ? e.message.slice(0, 300) : "onbekende fout" });
    return { id, outcome: "failed" as const };
  }
}
