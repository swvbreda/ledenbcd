export type TaskStatus = "te_doen" | "bezig" | "wacht" | "afgerond";
export type TaskPriority = "laag" | "normaal" | "hoog";
export type ProjectStatus = "actief" | "gepauzeerd" | "afgerond";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  te_doen: "Te doen",
  bezig: "Bezig",
  wacht: "Wacht op iemand",
  afgerond: "Afgerond",
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = { laag: "Laag", normaal: "Normaal", hoog: "Hoog" };
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  actief: "Actief",
  gepauzeerd: "Gepauzeerd",
  afgerond: "Afgerond",
};

const TEAMS_HOST = /^([a-z0-9-]+\.)*(teams\.microsoft\.com|teams\.live\.com|microsoft\.com|office\.com|sharepoint\.com)$/i;

/** Alleen geldige HTTPS-links naar Teams/Microsoft; spiegelt de databasecontrole. */
export function isValidTeamsUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && !u.username && !u.password && !u.port && TEAMS_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

export interface TaskLike {
  status: TaskStatus;
  deadline: string | null;
  assignee_id: string | null;
  project_id: string | null;
}

export function isOverdue(t: Pick<TaskLike, "status" | "deadline">, today: string): boolean {
  return !!t.deadline && t.status !== "afgerond" && t.deadline < today;
}

export interface TaskFilter {
  projectId: string | "all" | "none";
  status: TaskStatus | "open" | "all";
  mine: boolean;
  overdue: boolean;
}

export function filterTasks<T extends TaskLike>(tasks: T[], f: TaskFilter, userId: string | null, today: string): T[] {
  return tasks.filter((t) => {
    if (f.projectId === "none" && t.project_id) return false;
    if (f.projectId !== "all" && f.projectId !== "none" && t.project_id !== f.projectId) return false;
    if (f.status === "open" && t.status === "afgerond") return false;
    if (f.status !== "open" && f.status !== "all" && t.status !== f.status) return false;
    if (f.mine && (!userId || t.assignee_id !== userId)) return false;
    if (f.overdue && !isOverdue(t, today)) return false;
    return true;
  });
}

export interface LocalCompleteDb {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  from: (table: string) => any;
}

/** Lokale afronding: Topical via de geauditeerde admin-RPC, overige taken via gewone update. Nooit Microsoft-calls. */
export async function completeTaskLocally(db: LocalCompleteDb, t: { id: string; source_system?: string | null }): Promise<void> {
  if (t.source_system === "topical") {
    const { error } = await db.rpc("topical_complete_local_only", { _task_id: t.id });
    if (error) throw error;
    return;
  }
  const { data, error } = await db.from("internal_tasks").update({ status: "afgerond" }).eq("id", t.id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Geen toegang");
}

export type TaskView = "open" | "afgerond";
export type OpenStatusFilter = "open" | "te_doen" | "bezig" | "wacht";
export interface ViewFilter { projectId: string | "all" | "none"; openStatus: OpenStatusFilter; mine: boolean; overdue: boolean }

/** Splitst taken in 'Open taken' en 'Afgerond'. Open bevat nooit afgerond; Afgerond negeert open-status/verlopen. */
export function splitTaskViews<T extends TaskLike>(tasks: T[], f: ViewFilter, userId: string | null, today: string) {
  const base = { projectId: f.projectId, mine: f.mine };
  const open = filterTasks(tasks, { ...base, status: f.openStatus, overdue: f.overdue }, userId, today).filter((t) => t.status !== "afgerond");
  const done = filterTasks(tasks, { ...base, status: "afgerond", overdue: false }, userId, today);
  return { open, done };
}

/** Deep-link: een afgeronde taak opent altijd in de Afgerond-lijst. */
export function viewForTask(tasks: { id: string; status: TaskStatus }[], id: string | null): TaskView | null {
  const t = id ? tasks.find((x) => x.id === id) : undefined;
  return t ? (t.status === "afgerond" ? "afgerond" : "open") : null;
}

/** Cache direct bijwerken na succesvolle lokale afronding (vóór refetch). */
export function markCompletedInList<T extends { id: string; status: TaskStatus }>(tasks: T[] | undefined, id: string): T[] | undefined {
  return tasks?.map((t) => (t.id === id ? { ...t, status: "afgerond" as const } : t));
}
