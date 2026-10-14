import type { ReactNode } from "react";
import { ChevronRight, FileText, FolderOpen } from "lucide-react";
import type { ProjectStatus } from "@/lib/internalWork";
import { buildTree, filterTree, OTHER_PROJECTS, projectsFor, unlinkedProjects, type DossierLink, type DossierNode, type RegisterDossier } from "@/lib/dossierRegister";
import { DossierHideAction } from "@/components/projecten/DossierHideAction";
import { CountChip, ProjectStatusBadge, surfaceCls } from "@/components/projecten/ui";

type P = { id: string; title: string; archived_at: string | null; status: ProjectStatus };

/** Compacte weergave: hoofddossier → subdossiers → projecten; ongekoppeld onder "Overige projecten". */
export default function DossierGroupsView({ dossiers, links, projects, onOpen, selected = null, hidden, onSetHidden }: {
  selected?: string | null;
  /** Dossiers die in Projecten verborgen zijn (alleen zichtbaar bij "Toon verwijderde dossiers"). */
  hidden?: Set<string>;
  /** Alleen voor beheerders: verbergen/terugzetten in dit overzicht. */
  onSetHidden?: (id: string, hide: boolean) => Promise<void>; dossiers: RegisterDossier[]; links: DossierLink[]; projects: P[]; onOpen: (id: string) => void;
}) {
  const tree = filterTree(buildTree(dossiers), selected);
  const list = (ps: P[]) => ps.length === 0
    ? <p className="px-3 py-2 text-sm text-muted-foreground">Geen projecten</p>
    : (
      <ul className="divide-y divide-border/70">
        {ps.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen(p.id)}
              className={`group flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${p.archived_at ? "opacity-70" : ""}`}>
              <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">{p.title}</span>
              <ProjectStatusBadge status={p.status} archived={!!p.archived_at} />
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          </li>
        ))}
      </ul>
    );
  const count = (d: DossierNode) => {
    const ids = new Set<string>();
    for (const x of [d, ...d.children]) projectsFor(x.id, links, projects).forEach((p) => ids.add(p.id));
    return ids.size;
  };
  const others = unlinkedProjects(projects, links);
  const action = (d: RegisterDossier) => onSetHidden
    ? <DossierHideAction name={d.name} hidden={!!d.project_hidden_at} onSetHidden={(h) => onSetHidden(d.id, h)} />
    : null;
  const isHidden = (id: string) => !!hidden?.has(id);
  const head = (name: string, n: number, dashed = false, extra: ReactNode = null) => (
    <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-2">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${dashed ? "bg-muted text-muted-foreground" : "bg-brand-navy/10 text-brand-navy"}`}>
        <FolderOpen aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <h3 className="!font-sans min-w-0 flex-1 break-words text-lg font-semibold tracking-normal text-foreground">{name}</h3>
      <CountChip n={n} singular="project" plural="projecten" />
      {extra}
    </div>
  );
  return (
    <div className="space-y-4">
      {tree.map((d) => {
        const hideDirect = !!(selected && selected !== d.id && d.children.some((c) => c.id === selected));
        return (
          <section key={d.id} className={`${surfaceCls} min-w-0 pb-2 ${isHidden(d.id) ? "border-dashed opacity-70" : ""}`}>
            {head(isHidden(d.id) ? `${d.name} (verwijderd uit overzicht)` : d.name, count(d), false, action(d))}
            {/* Bij een gekozen subdossier geen (lege) directe lijst onder de ouder tonen. */}
            {!hideDirect && <div className="px-1">{list(projectsFor(d.id, links, projects))}</div>}
            {d.children.length > 0 && (
              <div className="space-y-2 px-3 pb-2 pt-1">
                {d.children.map((c) => {
                  const n = projectsFor(c.id, links, projects).length;
                  return (
                    <div key={c.id} className={`min-w-0 rounded-lg border-l-2 ${isHidden(c.id) ? "opacity-70 border-dashed" : ""} border-brand-navy/30 bg-muted/40 py-1 pl-1`}>
                      <div className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-1">
                        <h4 className="!font-sans min-w-0 flex-1 break-words text-sm font-semibold tracking-normal text-foreground">{c.name}</h4>
                        <span className="text-xs text-muted-foreground tabular-nums">{n} {n === 1 ? "project" : "projecten"}</span>
                        {isHidden(c.id) && <span className="text-xs text-muted-foreground">verwijderd uit overzicht</span>}
                        {!d.project_hidden_at && action(c)}
                      </div>
                      {list(projectsFor(c.id, links, projects))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      {!selected && others.length > 0 && (
        <section className="min-w-0 rounded-xl border border-dashed border-border bg-card pb-2">
          {head(OTHER_PROJECTS, others.length, true)}
          <div className="px-1">{list(others)}</div>
        </section>
      )}
    </div>
  );
}
