import type { ProjectStatus, TaskStatus } from "@/lib/internalWork";
import { parsePlan, splitCurrentStatus, type PlanBlock } from "@/lib/projectPlan";
import { presentText } from "@/lib/presentText";
import { dossierScope, projectInScope, type DossierLink, type RegisterDossier } from "@/lib/dossierRegister";

/** Vaste agendavolgorde; nooit herschikt of aangevuld. */
export const AGENDA_ITEMS = [
  "Opening en vaststellen agenda",
  "Vorige notulen/besluiten en openstaande acties",
  "Projectvoortgang",
  "Bespreek- en beslispunten",
  "Nieuwe acties en volgende vergadering",
  "Rondvraag en sluiting",
] as const;

export const NOT_SET = "Nog niet vastgelegd";

export type AgendaProject = {
  id: string; title: string; status: ProjectStatus; archived_at: string | null; owner_id: string | null;
  description: string | null; project_plan?: string | null; created_origin?: string | null;
  status_date?: string | null; planning?: string | null; planning_date?: string | null; remarks?: string | null;
};
export type AgendaTask = { id: string; title: string; project_id: string | null; status: TaskStatus; deadline: string | null; assignee_id: string | null };
export type AgendaFilter = { projectId: string | null; dossierId: string | null };

const blocksText = (b: PlanBlock[]) => b.map((x) => (x.type === "paragraph" ? x.text : x.type === "list" ? x.items.map((i) => `• ${i}`).join("\n") : x.items.map((i) => `${i.date} — ${i.title}: ${i.text}`).join("\n"))).join("\n").trim();

/** Werkelijk vastgelegde stand (omschrijving of plansectie 'Huidige stand'); anders null. */
export function recordedStand(p: AgendaProject): string | null {
  const s = splitCurrentStatus(presentText(p.project_plan), presentText(p.description, { autoImport: p.created_origin === "bronimport" })).status;
  return s ? blocksText(s.blocks) || null : null;
}

/** Bespreekpunten: uitsluitend expliciet vastgelegde opmerkingen en plansectie 'Vervolg'. */
export function discussionPoints(p: AgendaProject): string[] {
  const out: string[] = [];
  const r = p.remarks?.trim();
  if (r) out.push(r);
  for (const s of parsePlan(presentText(p.project_plan))) if (s.heading === "Vervolg") { const t = blocksText(s.blocks); if (t) out.push(t); }
  return out;
}

const isOpen = (t: AgendaTask) => t.status !== "afgerond";
const byDeadline = (a: AgendaTask, b: AgendaTask) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.title.localeCompare(b.title);
const STATUS_ORDER: Record<ProjectStatus, number> = { actief: 0, te_bevestigen: 1, gepauzeerd: 2, afgerond: 3 };

/** Een URL-filter dat niet (meer) naar een open project/dossier wijst is ongeldig; nooit verbreden naar alles. */
export function validateFilter(f: AgendaFilter, projects: AgendaProject[], dossiers: RegisterDossier[]) {
  const invalidProject = !!f.projectId && !projects.some((p) => p.id === f.projectId && !p.archived_at);
  const invalidDossier = !!f.dossierId && !dossiers.some((d) => d.id === f.dossierId && !d.archived_at);
  return { invalidProject, invalidDossier, invalid: invalidProject || invalidDossier };
}

/** Filterkeuze als één atomaire URL-update: kies project óf dossier, het andere wordt gewist. */
export function nextFilterParams(prev: URLSearchParams, key: "project" | "dossier", value: string): URLSearchParams {
  const n = new URLSearchParams(prev);
  n.delete("project"); n.delete("dossier");
  if (value) n.set(key, value);
  return n;
}

export const BESLUITENREGISTER_URL = "https://coffeeshopbond.sharepoint.com/sites/BondvanCannabisDetailisten/Lists/BCD%20Besluitenregister/AllItems.aspx?npsAction=createList";
export const TEAMS_ARCHIEF_PAD = "Algemeen > Gedeeld > Vergaderingen > Topical-archief";

export function buildAgenda(projects: AgendaProject[], tasks: AgendaTask[], links: DossierLink[], dossiers: RegisterDossier[], f: AgendaFilter) {
  const v = validateFilter(f, projects, dossiers);
  const scope = f.dossierId ? dossierScope(f.dossierId, dossiers) : null;
  const filtered = !!(f.projectId || f.dossierId);
  const visible = v.invalid ? [] : projects
    .filter((p) => !p.archived_at)
    .filter((p) => (!f.projectId || p.id === f.projectId) && (!scope || projectInScope(p.id, scope, links)))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title));
  const ids = new Set(visible.map((p) => p.id));
  const rows = visible.map((p) => ({
    project: p,
    stand: recordedStand(p),
    points: discussionPoints(p),
    openTasks: tasks.filter((t) => t.project_id === p.id && isOpen(t)).sort(byDeadline),
  }));
  const knownProjects = new Set(projects.filter((p) => !p.archived_at).map((p) => p.id));
  // Acties zonder zichtbaar project alleen in de ongefilterde agenda (anders lekt scope).
  const unscoped = filtered ? [] : tasks.filter((t) => isOpen(t) && (!t.project_id || !knownProjects.has(t.project_id))).sort(byDeadline);
  return {
    active: rows.filter((r) => r.project.status !== "afgerond"),
    completed: rows.filter((r) => r.project.status === "afgerond"),
    unscoped,
    filtered, ...v,
    openActionCount: rows.reduce((n, r) => n + r.openTasks.length, 0) + unscoped.length,
    projectIds: ids,
  };
}
