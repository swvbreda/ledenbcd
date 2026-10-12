/**
 * Push-afhandeling voor taaktoewijzingen. Ontvanger komt uitsluitend uit de
 * database-melding (gemaakt door trigger), nooit uit de client.
 * Lockscreen-tekst is generiek; alleen taskId zit in de navigatieroute.
 */
export const PUSH_TITLE = "Nieuwe taak toegewezen";
export const PUSH_BODY = "Er staat een nieuwe taak voor je klaar";
export const MAX_PUSH_ATTEMPTS = 5;
export const STALE_SENDING_MS = 5 * 60_000;

export type NotificationRow = { id: string; recipient_id: string; task_id: string; push_attempts: number };
export type SendResult = { ok: boolean; status: number; reason?: string };

export interface TaskPushPort {
  /** Atomair claimen; null als al verwerkt/bezig of te vaak geprobeerd. */
  claim(id: string): Promise<NotificationRow | null>;
  isAdmin(userId: string): Promise<boolean>;
  currentTask(taskId: string): Promise<{ assignee_id: string | null; status: string } | null>;
  deviceTokens(userId: string): Promise<string[]>;
  finish(id: string, r: { status: "sent" | "no_devices" | "failed" | "skipped"; sent: number; total: number; error: string | null }): Promise<void>;
  removeInvalidTokens(userId: string, tokens: string[]): Promise<void>;
}

export function taskRoute(taskId: string) {
  return `/projecten?task=${encodeURIComponent(taskId)}`;
}

const INVALID = ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"];

export async function processTaskNotification(
  db: TaskPushPort,
  send: (token: string, payload: { title: string; body: string; route: string }) => Promise<SendResult>,
  id: string,
) {
  const n = await db.claim(id);
  if (!n) return { id, outcome: "not_claimed" as const };
  try {
    const task = await db.currentTask(n.task_id);
    if (!task || task.assignee_id !== n.recipient_id || !(await db.isAdmin(n.recipient_id))) {
      await db.finish(n.id, { status: "skipped", sent: 0, total: 0, error: "Ontvanger is niet (meer) de bevoegde verantwoordelijke" });
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
    for (const t of tokens) {
      try {
        const r = await send(t, { title: PUSH_TITLE, body: PUSH_BODY, route: taskRoute(n.task_id) });
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
