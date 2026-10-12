/**
 * Synchronisatie Projecten & taken <-> Microsoft Planner.
 * Pure logica + engine met geïnjecteerde Graph- en database-adapters (testbaar met mocks).
 * Nooit tokens of secrets in resultaten of foutmeldingen.
 */
import type { TaskPriority, TaskStatus } from "@/lib/internalWork";

// ---------- Mapping ----------

/** Planner kent alleen 0 / 50 / 100. "wacht" wordt 50 en blijft lokaal "wacht" zolang Planner 50 houdt. */
export function statusToPercent(s: TaskStatus): 0 | 50 | 100 {
  return s === "afgerond" ? 100 : s === "te_doen" ? 0 : 50;
}
export function percentToStatus(p: number, current: TaskStatus | null): TaskStatus {
  if (p >= 100) return "afgerond";
  if (p <= 0) return "te_doen";
  return current === "wacht" ? "wacht" : "bezig";
}
/** Planner-prioriteit 0–10: 1 urgent, 3 belangrijk, 5 normaal, 9 laag. */
export function priorityToPlanner(p: TaskPriority): number {
  return p === "hoog" ? 3 : p === "laag" ? 9 : 5;
}
export function plannerToPriority(n: number | null | undefined): TaskPriority {
  if (n == null) return "normaal";
  if (n <= 4) return "hoog";
  if (n >= 8) return "laag";
  return "normaal";
}
/** Deadline (datum) als middag UTC, zodat de dag in NL-tijd gelijk blijft. */
export const deadlineToPlanner = (d: string | null) => (d ? `${d}T12:00:00Z` : null);
export const plannerToDeadline = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

export interface LocalTask {
  id: string; title: string; description: string | null; deadline: string | null;
  priority: TaskPriority; status: TaskStatus; assignee_id: string | null;
}
export interface RemoteTask {
  id: string; etag: string; title: string; percentComplete: number; priority: number | null;
  dueDateTime: string | null; assigneeIds: string[]; createdByAppId: string | null; createdDateTime: string | null;
  description: string | null; detailsEtag: string | null;
}
export interface TaskLink {
  task_id: string; plan_id: string; planner_task_id: string | null;
  state: "pending_create" | "creating" | "uncertain" | "linked" | "conflict" | "remote_missing";
  attempt_token: string | null; attempt_started_at: string | null;
  task_etag: string | null; details_etag: string | null;
  last_local_hash: string | null; last_remote_hash: string | null;
  seen_local_hash: string | null; seen_remote_hash: string | null;
  last_error: string | null;
}

/** Vergelijkbare toestand (lokaal of extern) in Planner-termen. */
export interface Canon { title: string; description: string; due: string | null; pct: number; prio: number; assignees: string }

const norm = (s: string | null | undefined) => (s ?? "").replace(/\r\n/g, "\n").trim();

export function canonLocal(t: LocalTask, entraOf: (uid: string) => string | null): Canon {
  const e = t.assignee_id ? entraOf(t.assignee_id) : null;
  return {
    title: norm(t.title), description: norm(t.description), due: t.deadline,
    pct: statusToPercent(t.status), prio: priorityToPlanner(t.priority), assignees: e ? e.toLowerCase() : "",
  };
}
export function canonRemote(r: RemoteTask): Canon {
  return {
    title: norm(r.title), description: norm(r.description), due: plannerToDeadline(r.dueDateTime),
    pct: r.percentComplete >= 100 ? 100 : r.percentComplete <= 0 ? 0 : 50,
    prio: priorityToPlanner(plannerToPriority(r.priority)),
    assignees: [...r.assigneeIds].map((x) => x.toLowerCase()).sort().join(","),
  };
}
export const hashCanon = (c: Canon) => JSON.stringify([c.title, c.description, c.due, c.pct, c.prio, c.assignees]);

export type Decision = "none" | "push" | "pull" | "conflict";
export function decide(link: Pick<TaskLink, "last_local_hash" | "last_remote_hash">, localHash: string, remoteHash: string): Decision {
  if (localHash === remoteHash) return "none";
  const lc = localHash !== link.last_local_hash;
  const rc = remoteHash !== link.last_remote_hash;
  if (lc && rc) return "conflict";
  if (lc) return "push";
  if (rc) return "pull";
  return "conflict"; // beide gelijk aan basis maar onderling verschillend: niet stil overschrijven
}

/** Zoekt een eerder (onzeker) aangemaakte taak terug: zelfde titel, door deze app, na de poging. */
export function reconcileCandidates(remote: RemoteTask[], title: string, appId: string, since: string | null, linkedIds: Set<string>): RemoteTask[] {
  const t0 = since ? Date.parse(since) - 60_000 : 0;
  return remote.filter(
    (r) => !linkedIds.has(r.id) && norm(r.title) === norm(title) && r.createdByAppId === appId &&
      (!r.createdDateTime || Date.parse(r.createdDateTime) >= t0),
  );
}

/** Externe assignees -> lokale verantwoordelijke; alleen bij precies één gekoppelde persoon. */
export function remoteAssigneeToLocal(ids: string[], userOf: (entra: string) => string | null): { ok: true; userId: string | null } | { ok: false; reason: string } {
  if (ids.length === 0) return { ok: true, userId: null };
  if (ids.length > 1) return { ok: false, reason: "Meerdere toegewezen personen in Planner; lokaal kan één verantwoordelijke." };
  const u = userOf(ids[0]);
  return u ? { ok: true, userId: u } : { ok: false, reason: "Planner-toewijzing is niet gekoppeld aan een BCD-beheerder." };
}

// ---------- Engine ----------

export class GraphError extends Error {
  constructor(public status: number, message: string, public uncertain = false) { super(message); }
}

export interface GraphPort {
  listPlanTasks(planId: string): Promise<RemoteTask[]>;
  getDetails(taskId: string): Promise<{ description: string | null; etag: string }>;
  createTask(body: Record<string, unknown>): Promise<{ id: string; etag: string }>;
  patchTask(taskId: string, etag: string, body: Record<string, unknown>): Promise<{ etag: string | null }>;
  patchDetails(taskId: string, etag: string, body: Record<string, unknown>): Promise<{ etag: string | null }>;
}
export interface DbPort {
  tasks(projectId: string): Promise<LocalTask[]>;
  links(taskIds: string[]): Promise<TaskLink[]>;
  userMap(): Promise<{ user_id: string; entra_id: string }[]>;
  saveLink(l: Partial<TaskLink> & { task_id: string }): Promise<void>;
  updateTask(id: string, patch: Partial<LocalTask>): Promise<void>;
  newToken(): string;
  now(): string;
}
export interface SyncResult { created: number; updatedRemote: number; updatedLocal: number; conflicts: number; warnings: string[] }

const UNCERTAIN_GRACE_MS = 2 * 60_000;

export async function syncProject(opts: { projectId: string; planId: string; appId: string; graph: GraphPort; db: DbPort }): Promise<SyncResult> {
  const { projectId, planId, appId, graph, db } = opts;
  const res: SyncResult = { created: 0, updatedRemote: 0, updatedLocal: 0, conflicts: 0, warnings: [] };
  const tasks = await db.tasks(projectId);
  const links = new Map((await db.links(tasks.map((t) => t.id))).map((l) => [l.task_id, l]));
  const map = await db.userMap();
  const entraOf = (u: string) => map.find((m) => m.user_id === u)?.entra_id ?? null;
  const userOf = (e: string) => map.find((m) => m.entra_id.toLowerCase() === e.toLowerCase())?.user_id ?? null;
  const remote = await graph.listPlanTasks(planId);
  const byId = new Map(remote.map((r) => [r.id, r]));
  const linkedIds = new Set([...links.values()].map((l) => l.planner_task_id).filter((x): x is string => !!x));

  for (const t of tasks) {
    let link = links.get(t.id) ?? null;
    if (link && link.plan_id !== planId) { res.warnings.push(`Taak "${t.title}" is aan een ander plan gekoppeld; overgeslagen.`); continue; }
    const local = canonLocal(t, entraOf);
    if (t.assignee_id && !entraOf(t.assignee_id)) res.warnings.push(`Verantwoordelijke van "${t.title}" heeft nog geen Microsoft-koppeling; toewijzing niet verstuurd.`);

    // --- Nog niet (zeker) aangemaakt ---
    if (!link || !link.planner_task_id) {
      if (link && (link.state === "creating" || link.state === "uncertain")) {
        const c = reconcileCandidates(remote, t.title, appId, link.attempt_started_at, linkedIds);
        if (c.length > 1) {
          await db.saveLink({ task_id: t.id, state: "conflict", last_error: "Meerdere mogelijke Planner-taken na onzekere aanmaak; kies handmatig." });
          res.conflicts++; continue;
        }
        if (c.length === 1) {
          const r = c[0];
          const h = hashCanon(canonRemote(r));
          await db.saveLink({ task_id: t.id, planner_task_id: r.id, state: "linked", task_etag: r.etag, details_etag: r.detailsEtag,
            last_local_hash: h, last_remote_hash: h, last_error: null });
          linkedIds.add(r.id);
          link = { ...link, planner_task_id: r.id, state: "linked", task_etag: r.etag, details_etag: r.detailsEtag, last_local_hash: h, last_remote_hash: h };
          // val door naar normale vergelijking
        } else if (link.attempt_started_at && Date.now() - Date.parse(link.attempt_started_at) < UNCERTAIN_GRACE_MS) {
          res.warnings.push(`Aanmaak van "${t.title}" is nog onzeker; volgende synchronisatie controleert opnieuw.`);
          continue;
        }
      }
      if (!link || !link.planner_task_id) {
        const token = db.newToken();
        const started = db.now();
        await db.saveLink({ task_id: t.id, plan_id: planId, state: "creating", attempt_token: token, attempt_started_at: started, last_error: null });
        const body: Record<string, unknown> = { planId, title: local.title, percentComplete: local.pct, priority: local.prio };
        if (local.due) body.dueDateTime = deadlineToPlanner(local.due);
        if (local.assignees) body.assignments = { [local.assignees]: { "@odata.type": "#microsoft.graph.plannerAssignment", orderHint: " !" } };
        let created: { id: string; etag: string };
        try {
          created = await graph.createTask(body);
        } catch (e) {
          const g = e instanceof GraphError ? e : null;
          const uncertain = !g || g.uncertain;
          await db.saveLink({ task_id: t.id, state: uncertain ? "uncertain" : "pending_create", last_error: safeMsg(e) });
          if (!uncertain) res.warnings.push(`Aanmaken "${t.title}" geweigerd: ${safeMsg(e)}`);
          else res.warnings.push(`Aanmaken "${t.title}" onzeker (${safeMsg(e)}); wordt bij volgende sync teruggezocht, niet blind herhaald.`);
          continue;
        }
        linkedIds.add(created.id);
        let detailsEtag: string | null = null;
        if (local.description) {
          try {
            const d = await graph.getDetails(created.id);
            detailsEtag = (await graph.patchDetails(created.id, d.etag, { description: local.description })).etag ?? null;
          } catch (e) { res.warnings.push(`Omschrijving "${t.title}" niet verstuurd: ${safeMsg(e)}`); }
        }
        const h = hashCanon(local);
        await db.saveLink({ task_id: t.id, planner_task_id: created.id, state: "linked", task_etag: created.etag, details_etag: detailsEtag,
          last_local_hash: h, last_remote_hash: detailsEtag || !local.description ? h : hashCanon({ ...local, description: "" }), last_error: null });
        res.created++;
        continue;
      }
    }

    // --- Gekoppeld ---
    const r = byId.get(link.planner_task_id!);
    if (!r) {
      await db.saveLink({ task_id: t.id, state: "remote_missing", last_error: "Taak niet (meer) gevonden in Planner; lokaal niets verwijderd." });
      res.warnings.push(`"${t.title}" staat niet meer in Planner; lokaal behouden.`);
      continue;
    }
    const remoteC = canonRemote(r);
    const lh = hashCanon(local), rh = hashCanon(remoteC);
    const d = decide(link, lh, rh);
    if (d === "none") {
      await db.saveLink({ task_id: t.id, state: "linked", task_etag: r.etag, details_etag: r.detailsEtag, last_local_hash: lh, last_remote_hash: rh, last_error: null });
      continue;
    }
    if (d === "conflict") {
      await db.saveLink({ task_id: t.id, state: "conflict", seen_local_hash: lh, seen_remote_hash: rh, task_etag: r.etag, details_etag: r.detailsEtag,
        last_error: "Zowel lokaal als in Planner gewijzigd; kies welke versie geldt." });
      res.conflicts++; continue;
    }
    if (d === "push") {
      try {
        const body: Record<string, unknown> = {};
        if (local.title !== remoteC.title) body.title = local.title;
        if (local.pct !== remoteC.pct) body.percentComplete = local.pct;
        if (local.prio !== remoteC.prio) body.priority = local.prio;
        if (local.due !== remoteC.due) body.dueDateTime = deadlineToPlanner(local.due);
        if (local.assignees !== remoteC.assignees && t.assignee_id && !entraOf(t.assignee_id)) {
          // niet-gekoppelde verantwoordelijke: externe toewijzing ongemoeid laten
        } else if (local.assignees !== remoteC.assignees) {
          const a: Record<string, unknown> = {};
          for (const x of r.assigneeIds) if (x.toLowerCase() !== local.assignees) a[x] = null;
          if (local.assignees) a[local.assignees] = { "@odata.type": "#microsoft.graph.plannerAssignment", orderHint: " !" };
          body.assignments = a;
        }
        let etag = r.etag;
        if (Object.keys(body).length) etag = (await graph.patchTask(r.id, r.etag, body)).etag ?? r.etag;
        let detailsEtag = r.detailsEtag;
        if (local.description !== remoteC.description && r.detailsEtag) {
          detailsEtag = (await graph.patchDetails(r.id, r.detailsEtag, { description: local.description })).etag ?? r.detailsEtag;
        }
        await db.saveLink({ task_id: t.id, state: "linked", task_etag: etag, details_etag: detailsEtag, last_local_hash: lh, last_remote_hash: lh, last_error: null });
        res.updatedRemote++;
      } catch (e) {
        if (e instanceof GraphError && e.status === 412) {
          await db.saveLink({ task_id: t.id, state: "conflict", seen_local_hash: lh, seen_remote_hash: rh, last_error: "Planner-taak is tussentijds gewijzigd (ETag); niet overschreven." });
          res.conflicts++;
        } else {
          await db.saveLink({ task_id: t.id, last_error: safeMsg(e) });
          res.warnings.push(`Bijwerken in Planner "${t.title}" mislukt: ${safeMsg(e)}`);
        }
      }
      continue;
    }
    // pull
    const patch: Partial<LocalTask> = {
      title: remoteC.title || t.title,
      description: remoteC.description || null,
      deadline: remoteC.due,
      priority: plannerToPriority(r.priority),
      status: percentToStatus(r.percentComplete, t.status),
    };
    const a = remoteAssigneeToLocal(r.assigneeIds, userOf);
    if (a.ok) patch.assignee_id = a.userId; else res.warnings.push(`"${t.title}": ${a.reason} Lokale verantwoordelijke ongewijzigd.`);
    try {
      await db.updateTask(t.id, patch);
      const newLocal = canonLocal({ ...t, ...patch }, entraOf);
      await db.saveLink({ task_id: t.id, state: "linked", task_etag: r.etag, details_etag: r.detailsEtag,
        last_local_hash: hashCanon(newLocal), last_remote_hash: rh, last_error: null });
      res.updatedLocal++;
    } catch (e) {
      await db.saveLink({ task_id: t.id, last_error: safeMsg(e) });
      res.warnings.push(`Lokaal bijwerken "${t.title}" mislukt: ${safeMsg(e)}`);
    }
  }
  return res;
}

/** Conflict oplossen: na keuze zal de volgende sync in één richting schrijven. */
export function resolveConflictPatch(link: Pick<TaskLink, "seen_local_hash" | "seen_remote_hash">, keep: "local" | "planner") {
  return keep === "local"
    ? { state: "linked" as const, last_remote_hash: link.seen_remote_hash, last_local_hash: null, last_error: null }
    : { state: "linked" as const, last_local_hash: link.seen_local_hash, last_remote_hash: null, last_error: null };
}

const SECRETISH = /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|Bearer\s+\S+|client_secret=\S+)/g;
export function safeMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "Onbekende fout");
  return m.replace(SECRETISH, "[verborgen]").slice(0, 300);
}
