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
  bucketId?: string | null;
  /** Gezet als details niet opgehaald konden worden; omschrijving is dan onbekend. */
  detailsError?: string | null;
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
/** Projectslot verloren of maximale duur bereikt: direct stoppen, niets meer schrijven. */
export class LockLostError extends Error {}

export interface GraphPort {
  /** Alleen taken in de gekoppelde bucket, mét expliciet opgehaalde details (of detailsError). */
  listBucketTasks(bucketId: string): Promise<RemoteTask[]>;
  getDetails(taskId: string): Promise<{ description: string | null; etag: string }>;
  createTask(body: Record<string, unknown>): Promise<{ id: string; etag: string }>;
  patchTask(taskId: string, etag: string, body: Record<string, unknown>): Promise<{ etag: string | null }>;
  patchDetails(taskId: string, etag: string, body: Record<string, unknown>): Promise<{ etag: string | null }>;
}
export interface DbPort {
  tasks(projectId: string): Promise<LocalTask[]>;
  links(taskIds: string[]): Promise<TaskLink[]>;
  /** Planner-taak-id's die (in welk project dan ook) al gekoppeld zijn. */
  linkedPlannerIds(): Promise<Set<string>>;
  userMap(): Promise<{ user_id: string; entra_id: string }[]>;
  saveLink(l: Partial<TaskLink> & { task_id: string }): Promise<void>;
  updateTask(id: string, patch: Partial<LocalTask>): Promise<void>;
  insertTask(projectId: string, t: Omit<LocalTask, "id">): Promise<string>;
  /** Verlengt het projectslot; gooit LockLostError als het slot weg is of de maximale duur verstreken is. */
  heartbeat(): Promise<void>;
  newToken(): string;
  now(): string;
}
export interface SyncResult { imported: number; created: number; updatedRemote: number; updatedLocal: number; conflicts: number; warnings: string[] }
export type SyncOutcome = "success" | "partial" | "failed";
export const syncOutcome = (r: SyncResult): SyncOutcome => (r.conflicts > 0 || r.warnings.length > 0 ? "partial" : "success");

export const UNCERTAIN_GRACE_MS = 2 * 60_000;

export async function syncProject(opts: { projectId: string; planId: string; bucketId: string; appId: string; graph: GraphPort; db: DbPort }): Promise<SyncResult> {
  const { projectId, planId, bucketId, appId, graph, db } = opts;
  const res: SyncResult = { imported: 0, created: 0, updatedRemote: 0, updatedLocal: 0, conflicts: 0, warnings: [] };
  await db.heartbeat();
  const tasks = await db.tasks(projectId);
  const links = new Map((await db.links(tasks.map((t) => t.id))).map((l) => [l.task_id, l]));
  const map = await db.userMap();
  const entraOf = (u: string) => map.find((m) => m.user_id === u)?.entra_id ?? null;
  const userOf = (e: string) => map.find((m) => m.entra_id.toLowerCase() === e.toLowerCase())?.user_id ?? null;
  const all = await graph.listBucketTasks(bucketId);
  // Verdediging: alleen taken die écht in deze bucket staan.
  const remote = all.filter((r) => !r.bucketId || r.bucketId === bucketId);
  const byId = new Map(remote.map((r) => [r.id, r]));
  const linkedIds = await db.linkedPlannerIds();
  for (const l of links.values()) if (l.planner_task_id) linkedIds.add(l.planner_task_id);
  await db.heartbeat();

  for (const t of tasks) {
    await db.heartbeat();
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
        if (c.length === 1 && !c[0].detailsError) {
          const r = c[0];
          const rh = hashCanon(canonRemote(r));
          // Lokaal blijft basis "onbekend" als het verschilt, zodat de volgende stap pusht i.p.v. stil als gelijk te markeren.
          await db.saveLink({ task_id: t.id, planner_task_id: r.id, state: "linked", task_etag: r.etag, details_etag: r.detailsEtag,
            last_local_hash: rh, last_remote_hash: rh, last_error: null });
          linkedIds.add(r.id);
          link = { ...link, planner_task_id: r.id, state: "linked", task_etag: r.etag, details_etag: r.detailsEtag, last_local_hash: rh, last_remote_hash: rh };
          // val door naar normale vergelijking
        } else if (c.length === 1) {
          res.warnings.push(`Aanmaak van "${t.title}" teruggevonden, maar details niet leesbaar; later opnieuw.`);
          continue;
        } else {
          // Geen kandidaat: nooit zelf opnieuw aanmaken. Afwezigheid is niet bewezen (lijst kan vertraagd zijn); beheerder beslist.
          const young = link.attempt_started_at && Date.now() - Date.parse(link.attempt_started_at) < UNCERTAIN_GRACE_MS;
          if (!young && link.state !== "uncertain") await db.saveLink({ task_id: t.id, state: "uncertain", last_error: "Aanmaak onzeker en niet teruggevonden; controleer Planner en kies 'opnieuw aanmaken' of koppel handmatig." });
          res.warnings.push(young
            ? `Aanmaak van "${t.title}" is nog onzeker; volgende synchronisatie controleert opnieuw.`
            : `Aanmaak van "${t.title}" onzeker en niet teruggevonden; beheerder moet beslissen (niet automatisch opnieuw aangemaakt).`);
          continue;
        }
      }
      if (link && link.state === "conflict" && !link.planner_task_id) { res.conflicts++; continue; }
      if (!link || !link.planner_task_id) {
        const token = db.newToken();
        const started = db.now();
        await db.saveLink({ task_id: t.id, plan_id: planId, state: "creating", attempt_token: token, attempt_started_at: started, last_error: null });
        const body: Record<string, unknown> = { planId, bucketId, title: local.title, percentComplete: local.pct, priority: local.prio };
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
          else res.warnings.push(`Aanmaken "${t.title}" onzeker (${safeMsg(e)}); wordt teruggezocht, niet blind herhaald.`);
          continue;
        }
        linkedIds.add(created.id);
        const h = hashCanon(local);
        // Zonder omschrijving telt Planner als lege omschrijving.
        const remoteNoDesc = hashCanon({ ...local, description: "" });
        await db.saveLink({ task_id: t.id, planner_task_id: created.id, state: "linked", task_etag: created.etag, details_etag: null,
          last_local_hash: local.description ? null : h, last_remote_hash: remoteNoDesc, last_error: null });
        let detailsEtag: string | null = null;
        if (local.description) {
          try {
            await db.heartbeat();
            const d = await graph.getDetails(created.id);
            detailsEtag = (await graph.patchDetails(created.id, d.etag, { description: local.description })).etag ?? null;
            await db.saveLink({ task_id: t.id, details_etag: detailsEtag, last_local_hash: h, last_remote_hash: h });
          } catch (e) {
            if (e instanceof LockLostError) throw e;
            // Basis lokaal blijft leeg: volgende sync probeert de omschrijving opnieuw te versturen.
            await db.saveLink({ task_id: t.id, last_error: `Omschrijving niet verstuurd: ${safeMsg(e)}` });
            res.warnings.push(`Omschrijving "${t.title}" niet verstuurd: ${safeMsg(e)}`);
          }
        }
        res.created++;
        continue;
      }
    }

    // --- Gekoppeld ---
    const r = byId.get(link.planner_task_id!);
    if (!r) {
      await db.saveLink({ task_id: t.id, state: "remote_missing", last_error: "Taak niet (meer) gevonden in de gekoppelde Planner-bucket; lokaal niets verwijderd." });
      res.warnings.push(`"${t.title}" staat niet (meer) in de gekoppelde bucket; lokaal behouden.`);
      continue;
    }
    if (r.detailsError) {
      // Zonder details is de omschrijving onbekend: niet vergelijken, niets schrijven, basis niet bijwerken.
      res.warnings.push(`Details van "${t.title}" niet leesbaar (${r.detailsError}); deze taak is overgeslagen.`);
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
      let etag = r.etag;
      let taskPatched = false;
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
        if (Object.keys(body).length) { etag = (await graph.patchTask(r.id, r.etag, body)).etag ?? r.etag; taskPatched = true; }
        let detailsEtag = r.detailsEtag;
        if (local.description !== remoteC.description) {
          await db.heartbeat();
          if (!detailsEtag) throw new GraphError(0, "ETag van taakdetails ontbreekt; omschrijving niet verstuurd");
          detailsEtag = (await graph.patchDetails(r.id, detailsEtag, { description: local.description })).etag ?? detailsEtag;
        }
        await db.saveLink({ task_id: t.id, state: "linked", task_etag: etag, details_etag: detailsEtag, last_local_hash: lh, last_remote_hash: lh, last_error: null });
        res.updatedRemote++;
      } catch (e) {
        if (e instanceof LockLostError) throw e;
        if (e instanceof GraphError && e.status === 412) {
          await db.saveLink({ task_id: t.id, state: "conflict", seen_local_hash: lh, seen_remote_hash: rh, last_error: "Planner-taak is tussentijds gewijzigd (ETag); niet overschreven." });
          res.conflicts++;
        } else {
          // Nooit succes vastleggen voor wat niet is aangekomen. Basis lokaal blijft, extern = wat er nu werkelijk staat.
          const partialRemote = taskPatched ? hashCanon({ ...local, description: remoteC.description }) : link.last_remote_hash;
          await db.saveLink({ task_id: t.id, task_etag: etag, last_remote_hash: partialRemote, last_error: safeMsg(e) });
          res.warnings.push(`Bijwerken in Planner "${t.title}" (deels) mislukt: ${safeMsg(e)}`);
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
      if (e instanceof LockLostError) throw e;
      await db.saveLink({ task_id: t.id, last_error: safeMsg(e) });
      res.warnings.push(`Lokaal bijwerken "${t.title}" mislukt: ${safeMsg(e)}`);
    }
  }

  // --- Nieuw in de gekoppelde bucket: lokaal overnemen (niet door deze app gemaakt, nergens gekoppeld) ---
  for (const r of remote) {
    if (linkedIds.has(r.id)) continue;
    await db.heartbeat();
    if (r.createdByAppId === appId) { res.warnings.push(`Planner-taak "${r.title}" is door deze koppeling gemaakt maar niet gekoppeld; handmatig controleren.`); continue; }
    if (r.detailsError) { res.warnings.push(`Planner-taak "${r.title}" niet overgenomen: details niet leesbaar (${r.detailsError}).`); continue; }
    const a = remoteAssigneeToLocal(r.assigneeIds, userOf);
    if (!a.ok) res.warnings.push(`"${r.title}": ${a.reason} Overgenomen zonder verantwoordelijke.`);
    const t: Omit<LocalTask, "id"> = {
      title: (r.title || "Planner-taak").slice(0, 200), description: r.description || null, deadline: plannerToDeadline(r.dueDateTime),
      priority: plannerToPriority(r.priority), status: percentToStatus(r.percentComplete, null), assignee_id: a.ok ? a.userId : null,
    };
    try {
      const id = await db.insertTask(projectId, t);
      const lh = hashCanon(canonLocal({ id, ...t }, entraOf));
      await db.saveLink({ task_id: id, plan_id: planId, planner_task_id: r.id, state: "linked", task_etag: r.etag, details_etag: r.detailsEtag,
        last_local_hash: lh, last_remote_hash: hashCanon(canonRemote(r)), last_error: null });
      linkedIds.add(r.id);
      res.imported++;
    } catch (e) {
      if (e instanceof LockLostError) throw e;
      res.warnings.push(`Overnemen "${r.title}" mislukt: ${safeMsg(e)}`);
    }
  }
  return res;
}

/** Beheerderbesluit bij onzekere aanmaak: pas na expliciete keuze mag opnieuw worden aangemaakt. */
export function resolveUncertainPatch(action: "retry_create") {
  return action === "retry_create" ? { state: "pending_create" as const, attempt_token: null, attempt_started_at: null, last_error: null } : null;
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
