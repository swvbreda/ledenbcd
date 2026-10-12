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
