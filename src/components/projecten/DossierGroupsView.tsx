import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/internalWork";
import { buildTree, filterTree, OTHER_PROJECTS, projectsFor, unlinkedProjects, type DossierLink, type DossierNode, type RegisterDossier } from "@/lib/dossierRegister";

type P = { id: string; title: string; archived_at: string | null; status: ProjectStatus };

/** Compacte weergave: hoofddossier → subdossiers → projecten; ongekoppeld onder "Overige projecten". */
export default function DossierGroupsView({ dossiers, links, projects, onOpen, selected = null }: {
  selected?: string | null; dossiers: RegisterDossier[]; links: DossierLink[]; projects: P[]; onOpen: (id: string) => void;
}) {
  const tree = filterTree(buildTree(dossiers), selected);
  const list = (ps: P[]) => ps.length === 0
    ? <p className="text-xs text-muted-foreground px-1">Geen projecten</p>
    : (
      <ul className="divide-y divide-border/60">
        {ps.map((p) => (
          <li key={p.id} className={`flex items-center gap-2 py-1 px-1 ${p.archived_at ? "opacity-60" : ""}`}>
            <button type="button" className="min-w-0 flex-1 text-left text-sm hover:underline break-words" onClick={() => onOpen(p.id)}>{p.title}</button>
            <Badge variant="outline" className="shrink-0 text-[10px]">{p.archived_at ? "Gearchiveerd" : PROJECT_STATUS_LABEL[p.status]}</Badge>
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
  return (
    <div className="space-y-2">
      {tree.map((d) => (
        <section key={d.id} className="rounded-lg border border-border bg-card p-3 min-w-0">
          <h3 className="flex items-baseline gap-2 font-medium break-words">{d.name}
            <span className="text-xs font-normal text-muted-foreground tabular-nums">{count(d)} project{count(d) === 1 ? "" : "en"}</span></h3>
          {/* Bij een gekozen subdossier geen (lege) directe lijst onder de ouder tonen. */}
          {!(selected && selected !== d.id && d.children.some((c) => c.id === selected)) && <div className="mt-1">{list(projectsFor(d.id, links, projects))}</div>}
          {d.children.map((c) => (
            <div key={c.id} className="mt-2 ml-3 border-l-2 border-border pl-3 min-w-0">
              <h4 className="text-sm font-medium break-words">{c.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">{projectsFor(c.id, links, projects).length}</span></h4>
              {list(projectsFor(c.id, links, projects))}
            </div>
          ))}
        </section>
      ))}
      {!selected && others.length > 0 && (
        <section className="rounded-lg border border-dashed border-border p-3">
          <h3 className="font-medium">{OTHER_PROJECTS} <span className="text-xs font-normal text-muted-foreground tabular-nums">{others.length}</span></h3>
          <div className="mt-1">{list(others)}</div>
        </section>
      )}
    </div>
  );
}
