// Gedeelde dossierindeling (hoofddossier → subdossiers → projecten) voor
// Projecten, Jaarplan en Financiën. Puur: geen queries, geen fuzzy matching.

export type RegisterDossier = {
  id: string; parent_id: string | null; name: string; sort_order: number;
  jaarplan_kind: "hoofdstuk" | "thema" | null; jaarplan_section: string | null; jaarplan_pages: string | null;
  note: string | null; archived_at: string | null;
};
export type FinanceAlias = { dossier_id: string; label: string };
export type DossierLink = { dossier_id: string; project_id: string };
export type ProjectLite = { id: string; title: string; archived_at: string | null };

export type DossierNode = RegisterDossier & { children: DossierNode[] };

export const OTHER_PROJECTS = "Overige projecten";
export const UNLINKED_FINANCE = "Nog niet gekoppeld";

const bySort = (a: RegisterDossier, b: RegisterDossier) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "nl");

/** Hoofddossiers met subdossiers (één niveau), gesorteerd. */
export function buildTree(dossiers: RegisterDossier[]): DossierNode[] {
  const active = dossiers.filter((d) => !d.archived_at);
  const ids = new Set(active.map((d) => d.id));
  return active
    .filter((d) => !d.parent_id || !ids.has(d.parent_id))
    .sort(bySort)
    .map((d) => ({ ...d, children: active.filter((c) => c.parent_id === d.id).sort(bySort).map((c) => ({ ...c, children: [] })) }));
}

/**
 * Beperkt de boom tot het gekozen filter: hoofddossier → die groep met alle
 * subdossiers; subdossier → de ouder met uitsluitend dat subdossier.
 * Zonder (geldig) filter blijft de volledige boom staan.
 */
export function filterTree(tree: DossierNode[], selected: string | null): DossierNode[] {
  if (!selected) return tree;
  const top = tree.find((d) => d.id === selected);
  if (top) return [top];
  const parent = tree.find((d) => d.children.some((c) => c.id === selected));
  return parent ? [{ ...parent, children: parent.children.filter((c) => c.id === selected) }] : tree;
}

/**
 * Exacte lookup van een financieel dossierlabel. Alleen witruimte aan de randen
 * wordt genegeerd; hoofdletters/spelling moeten exact overeenkomen. Een label dat
 * alleen qua hoofdletters gelijk is, levert dus géén koppeling op.
 */
export function resolveFinanceLabel(label: string | null | undefined, aliases: FinanceAlias[]): string | null {
  const l = (label ?? "").trim();
  if (!l) return null;
  return aliases.find((a) => a.label === l)?.dossier_id ?? null;
}

export function aliasesFor(dossierId: string, aliases: FinanceAlias[]): string[] {
  return aliases.filter((a) => a.dossier_id === dossierId).map((a) => a.label);
}

export function projectsFor<P extends ProjectLite>(dossierId: string, links: DossierLink[], projects: P[]): P[] {
  const ids = new Set(links.filter((l) => l.dossier_id === dossierId).map((l) => l.project_id));
  return projects.filter((p) => ids.has(p.id));
}

export function dossiersForProject(projectId: string, links: DossierLink[], dossiers: RegisterDossier[]): RegisterDossier[] {
  const ids = new Set(links.filter((l) => l.project_id === projectId).map((l) => l.dossier_id));
  return dossiers.filter((d) => ids.has(d.id)).sort(bySort);
}

/** Projecten zonder enige dossierkoppeling (getoond als "Overige projecten"). */
export function unlinkedProjects<P extends ProjectLite>(projects: P[], links: DossierLink[]): P[] {
  const linked = new Set(links.map((l) => l.project_id));
  return projects.filter((p) => !linked.has(p.id));
}

/** Dossier + subdossiers (voor het dossierfilter in Projecten). */
export function dossierScope(dossierId: string, dossiers: RegisterDossier[]): Set<string> {
  return new Set([dossierId, ...dossiers.filter((d) => d.parent_id === dossierId).map((d) => d.id)]);
}

export function projectInScope(projectId: string, scope: Set<string>, links: DossierLink[]): boolean {
  return links.some((l) => l.project_id === projectId && scope.has(l.dossier_id));
}

/** Te koppelen/ontkoppelen dossiers bij bewerken van een project. */
export function diffLinks(current: string[], next: string[]) {
  const c = new Set(current), n = new Set(next);
  return { add: [...n].filter((x) => !c.has(x)), remove: [...c].filter((x) => !n.has(x)) };
}

export function jaarplanRef(d: Pick<RegisterDossier, "jaarplan_kind" | "jaarplan_section" | "jaarplan_pages">): string | null {
  if (!d.jaarplan_kind || !d.jaarplan_pages) return null;
  return d.jaarplan_kind === "thema"
    ? `Jaarplanthema ${d.jaarplan_section ?? ""}, p. ${d.jaarplan_pages}`
    : `Jaarplan p. ${d.jaarplan_pages}`;
}

// ---- Financiën deeplinks ----
export const FINANCE_TABS = ["dashboard", "intern", "contributie", "boekingen", "dossiers", "todo", "controle"] as const;
export type FinanceTab = (typeof FINANCE_TABS)[number];

export function financeDossierHref(alias: string, year: number): string {
  const q = new URLSearchParams({ tab: "dossiers", year: String(year), dossier: alias });
  return `/financien?${q.toString()}`;
}

/** Valideert ?tab=&year=&dossier=; ongeldige waarden vallen terug op standaard. */
/** TanStack serialiseert numeriek ogende strings als JSON ("2025"); haal die quotes eraf. */
export function unquoteSearch(raw: string | null): string | null {
  if (raw == null) return null;
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    try { const v = JSON.parse(raw); return typeof v === "string" ? v : raw; } catch { return raw; }
  }
  return raw;
}

export function parseFinanceSearch(params: URLSearchParams, years: number[], fallbackYear: number) {
  const t = unquoteSearch(params.get("tab"));
  const tab: FinanceTab = (FINANCE_TABS as readonly string[]).includes(t ?? "") ? (t as FinanceTab) : "dashboard";
  const yRaw = unquoteSearch(params.get("year"));
  const y = yRaw && /^\d{4}$/.test(yRaw) ? Number(yRaw) : NaN;
  const year = Number.isInteger(y) && years.includes(y) ? y : fallbackYear;
  const raw = unquoteSearch(params.get("dossier"));
  const dossier = raw && raw.trim() && raw.length <= 200 ? raw.trim() : null;
  return { tab, year, dossier };
}

export function projectsDossierHref(dossierId: string): string {
  return `/projecten?${new URLSearchParams({ dossier: dossierId }).toString()}`;
}
