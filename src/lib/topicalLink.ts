/** Pure logica voor het koppelen en afronden van Topical-acties (To Do + Planner). Geen netwerk/DB hier. */
import { GraphError, safeMsg } from "@/lib/plannerSync";

export const TOPICAL_SOURCE_LINE = /^Bron: Topical BCD — actie ([0-9]{1,12})\s*$/;

/** Bron-id uit de eerste beschrijvingsregel (zelfde regel als de database-backfill). */
export function parseTopicalRef(description: string | null | undefined): string | null {
  const first = (description ?? "").split("\n")[0];
  return TOPICAL_SOURCE_LINE.exec(first)?.[1] ?? null;
}

/** Exact onze eigen bronregel (eerste regel), zoals bij de import en in de Planner-notities. */
export function firstLineHasRef(text: string | null | undefined, ref: string): boolean {
  return parseTopicalRef(text) === ref;
}

export function isTopicalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "topicalmeetings.com" || h.endsWith(".topicalmeetings.com");
}

/** Echte Topical-URL (https, geldig domein) waarvan een padsegment of queryparameter exact het id is. */
export function topicalUrlHasRef(raw: string, ref: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || !isTopicalHost(u.hostname)) return false;
  return u.pathname.split("/").some((seg) => decodeURIComponent(seg) === ref) || [...u.searchParams.values()].includes(ref);
}

const urlsIn = (text: string) => text.match(/https:\/\/[^\s"'<>]+/gi)?.map((x) => x.replace(/&amp;/g, "&").replace(/[).,;]+$/, "")) ?? [];

/** Betrouwbare bron-id: exacte eigen bronregel of een echte Topical-URL met exact id. Losse "actie N" telt niet. */
export function textHasTopicalRef(text: string | null | undefined, ref: string): boolean {
  if (!text || !/^[0-9]{1,12}$/.test(ref)) return false;
  return firstLineHasRef(text, ref) || urlsIn(text).some((u) => topicalUrlHasRef(u, ref));
}

/** Generieke Planner-import: herkenbare Topical-taak of niet te controleren (details ontbreken) = overslaan. */
export function skipForGenericPlanner(t: { description: string | null; detailsError?: string | null }): boolean {
  if (t.detailsError || t.description === null) return true;
  return /^Bron: Topical BCD — actie [0-9]{1,12}\s*$/.test(t.description.split("\n")[0]);
}

export const normTitle = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

export interface LocalSourceTask { id: string; title: string; source_ref: string }
export interface TodoLinkedResource { applicationName: string; externalId: string; webUrl: string }
export interface TodoTaskLite { id: string; title: string; body: string; status: string; linkedResources: TodoLinkedResource[]; due?: string | null }
export interface PlannerTaskLite { id: string; title: string; description: string | null; planId: string }

export function todoHasRef(t: TodoTaskLite, ref: string) {
  // linkedResource alleen met Topical-provider, exact id én echte Topical-URL.
  const lr = t.linkedResources.some((l) => /topical/i.test(l.applicationName) && l.externalId === ref && topicalUrlHasRef(l.webUrl, ref));
  return lr || firstLineHasRef(t.body, ref) || urlsIn(`${t.title}\n${t.body}`).some((u) => topicalUrlHasRef(u, ref));
}

export type TodoCandidate =
  | { taskId: string; kind: "source_id"; todoId: string }
  | { taskId: string; kind: "title_only"; todoIds: string[] }
  | { taskId: string; kind: "ambiguous"; todoIds: string[] }
  | { taskId: string; kind: "none" };

/** Automatisch alleen bij één-op-één bron-id; titel-overeenkomst vraagt altijd handmatige bevestiging. */
export function matchTodo(locals: LocalSourceTask[], remote: TodoTaskLite[], alreadyLinked: Set<string> = new Set()): TodoCandidate[] {
  const free = remote.filter((r) => !alreadyLinked.has(r.id));
  const byRemote = new Map<string, string[]>();
  const hits = new Map<string, TodoTaskLite[]>();
  for (const l of locals) {
    const h = free.filter((r) => todoHasRef(r, l.source_ref));
    hits.set(l.id, h);
    for (const r of h) byRemote.set(r.id, [...(byRemote.get(r.id) ?? []), l.id]);
  }
  return locals.map((l): TodoCandidate => {
    const h = hits.get(l.id) ?? [];
    if (h.length === 1 && (byRemote.get(h[0].id) ?? []).length === 1) return { taskId: l.id, kind: "source_id", todoId: h[0].id };
    if (h.length > 1 || (h.length === 1)) return { taskId: l.id, kind: "ambiguous", todoIds: h.map((x) => x.id) };
    const t = free.filter((r) => normTitle(r.title) === normTitle(l.title)).map((r) => r.id);
    return t.length ? { taskId: l.id, kind: "title_only", todoIds: t } : { taskId: l.id, kind: "none" };
  });
}

export type PlannerCandidate = { taskId: string; kind: "source_id"; plannerId: string } | { taskId: string; kind: "ambiguous" | "none"; plannerIds: string[] };

/** Planner: uitsluitend bron-id in de taaknotitie én het vastgestelde plan; nooit op titel, nooit aanmaken. */
export function matchPlanner(locals: LocalSourceTask[], remote: PlannerTaskLite[], planId: string, alreadyLinked: Set<string> = new Set()): PlannerCandidate[] {
  const pool = remote.filter((r) => r.planId === planId && !alreadyLinked.has(r.id));
  const byRemote = new Map<string, number>();
  const hits = new Map<string, PlannerTaskLite[]>();
  for (const l of locals) {
    const h = pool.filter((r) => firstLineHasRef(r.description, l.source_ref));
    hits.set(l.id, h);
    for (const r of h) byRemote.set(r.id, (byRemote.get(r.id) ?? 0) + 1);
  }
  return locals.map((l): PlannerCandidate => {
    const h = hits.get(l.id) ?? [];
    if (h.length === 1 && byRemote.get(h[0].id) === 1) return { taskId: l.id, kind: "source_id", plannerId: h[0].id };
    return { taskId: l.id, kind: h.length ? "ambiguous" : "none", plannerIds: h.map((x) => x.id) };
  });
}

// ---------- Afronden ----------

export interface TopicalLink {
  task_id: string; source_ref: string;
  todo_user_id: string | null; todo_list_id: string | null; todo_task_id: string | null; todo_match: string | null; todo_completed_at: string | null;
  planner_plan_id: string | null; planner_task_id: string | null; planner_completed_at: string | null;
}

export interface CompletionPort {
  getTodo(userId: string, listId: string, todoId: string): Promise<TodoTaskLite & { etag: string }>;
  completeTodo(userId: string, listId: string, todoId: string, etag: string): Promise<void>;
  getPlanner(id: string): Promise<{ etag: string; planId: string; percentComplete: number; description: string | null }>;
  completePlanner(id: string, etag: string): Promise<void>;
}
export interface CompletionDb {
  saveLink(patch: Partial<TopicalLink> & { last_error: string | null }): Promise<void>;
  markLocalDone(): Promise<void>;
  now(): string;
}

export type StepState = "done" | "already" | "failed" | "skipped";
export interface CompletionResult {
  todo: { state: StepState; message: string };
  planner: { state: StepState; message: string };
  local: "afgerond" | "unchanged";
}

export const TODO_SENT_MSG = "Naar Microsoft To Do verstuurd; Topical verwerkt dit via de bestaande koppeling (eindstand in Topical is niet via Microsoft te controleren).";

export function stepError(e: unknown, what: string): string {
  if (e instanceof GraphError) {
    if (e.status === 401 || e.status === 403) return `${what}: geen rechten bij Microsoft (${e.status}). Beheerderstoestemming voor Tasks.ReadWrite.All ontbreekt.`;
    if (e.status === 404) return `${what}: gekoppelde taak bestaat niet meer bij Microsoft; koppeling opnieuw controleren.`;
    if (e.status === 409 || e.status === 412) return `${what}: taak is intussen elders gewijzigd (versieconflict). Opnieuw proberen leest de nieuwe versie.`;
  }
  return `${what}: ${safeMsg(e)}`;
}

/** Vereisten vóór enig Microsoft-verzoek. Geeft null als alles klaar is, anders een begrijpelijke blokkade. */
export function completionBlocker(link: TopicalLink | null, canWrite: boolean, planId: string): string | null {
  if (!canWrite) return "Microsoft-recht Tasks.ReadWrite.All ontbreekt; afronden wordt niet naar To Do/Planner gestuurd en de taak blijft lokaal open.";
  if (!link) return "Nog niet gekoppeld aan de originele To Do-taak en Planner-taak. Koppel eerst in het tabblad Topical.";
  if (!link.todo_task_id || !link.todo_user_id || !link.todo_list_id) return "Originele Microsoft To Do-taak is nog niet gekoppeld.";
  if (!link.planner_task_id) return "Bestaande Planner-taak is nog niet gekoppeld.";
  if (link.planner_plan_id !== planId) return "Planner-koppeling hoort niet bij het vastgestelde plan.";
  return null;
}

/**
 * Leest altijd de actuele externe stand (ook bij retry; historische tijdstempels tellen niet als huidige stand).
 * Alleen een nu-al-voltooide taak slaat PATCH over. PATCH uitsluitend met zojuist gelezen ETag (If-Match); daarna
 * opnieuw lezen en pas als voltooid/100% bevestigd telt de stap. Lokaal pas afgerond als beide in déze run bevestigd zijn.
 */
export async function completeTopicalTask(link: TopicalLink, port: CompletionPort, db: CompletionDb, planId: string): Promise<CompletionResult> {
  const res: CompletionResult = { todo: { state: "skipped", message: "" }, planner: { state: "skipped", message: "" }, local: "unchanged" };
  const errors: string[] = [];
  let todoOk = false, plannerOk = false;

  try {
    const t = await port.getTodo(link.todo_user_id!, link.todo_list_id!, link.todo_task_id!);
    if (link.todo_match === "source_id" && !todoHasRef(t, link.source_ref)) throw new Error("To Do-taak draagt de bron-id niet meer; koppeling opnieuw controleren.");
    if (t.status !== "completed") {
      if (!t.etag) throw new Error("ETag ontbreekt; niet verstuurd.");
      await port.completeTodo(link.todo_user_id!, link.todo_list_id!, link.todo_task_id!, t.etag);
      const after = await port.getTodo(link.todo_user_id!, link.todo_list_id!, link.todo_task_id!);
      if (after.status !== "completed") throw new Error("Na verzenden staat de To Do-taak niet op voltooid.");
    }
    todoOk = true;
    res.todo = { state: t.status === "completed" ? "already" : "done", message: TODO_SENT_MSG };
  } catch (e) {
    const m = stepError(e, "Microsoft To Do"); errors.push(m); res.todo = { state: "failed", message: m };
  }

  try {
    const p = await port.getPlanner(link.planner_task_id!);
    if (p.planId !== planId) throw new Error("Planner-taak hoort niet (meer) bij het vastgestelde plan.");
    if (!firstLineHasRef(p.description, link.source_ref)) throw new Error("Planner-notitie draagt de bron-id niet meer; koppeling opnieuw controleren.");
    if (p.percentComplete !== 100) {
      if (!p.etag) throw new Error("ETag ontbreekt; niet verstuurd.");
      await port.completePlanner(link.planner_task_id!, p.etag);
      const after = await port.getPlanner(link.planner_task_id!);
      if (after.percentComplete !== 100) throw new Error("Na verzenden staat de Planner-taak niet op 100%.");
    }
    plannerOk = true;
    res.planner = { state: p.percentComplete === 100 ? "already" : "done", message: "Planner-taak staat op 100%." };
  } catch (e) {
    const m = stepError(e, "Planner"); errors.push(m); res.planner = { state: "failed", message: m };
  }

  const now = db.now();
  await db.saveLink({ task_id: link.task_id, todo_completed_at: todoOk ? now : null, planner_completed_at: plannerOk ? now : null, last_error: errors.length ? errors.join(" | ").slice(0, 1000) : null });
  if (todoOk && plannerOk) { await db.markLocalDone(); res.local = "afgerond"; }
  return res;
}

export function completionSummary(r: CompletionResult): { ok: boolean; text: string } {
  if (r.local === "afgerond") return { ok: true, text: `Lokaal afgerond. ${r.todo.message} ${r.planner.message}`.trim() };
  const parts = [r.todo.state === "failed" ? r.todo.message : `To Do: ${r.todo.message}`, r.planner.state === "failed" ? r.planner.message : `Planner: ${r.planner.message}`];
  return { ok: false, text: `Niet volledig afgerond; taak blijft lokaal open. ${parts.join(" ")} Opnieuw proberen herhaalt alleen de mislukte stap.` };
}
