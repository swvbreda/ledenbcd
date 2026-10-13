import { Link } from "@/lib/router-compat";
import { useDossierRegister } from "@/hooks/useDossierRegister";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildTree, jaarplanRef, projectsDossierHref, projectsFor, type DossierNode } from "@/lib/dossierRegister";

/** Alleen voor beheerders gerenderd; data is bovendien admin-only via RLS. */
export default function JaarplanDossiersWidget() {
  const reg = useDossierRegister(true);
  const projectsQ = useQuery({
    queryKey: ["jaarplan-dossier-projects"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("internal_projects").select("id,title,archived_at");
      if (error) throw error;
      return data as { id: string; title: string; archived_at: string | null }[];
    },
  });
  if (reg.error || projectsQ.error) return null;
  const projects = (projectsQ.data ?? []).filter((p) => !p.archived_at);
  const tree = buildTree(reg.dossiers);
  if (!tree.length) return null;
  const Item = ({ d, sub }: { d: DossierNode; sub?: boolean }) => {
    const ref = jaarplanRef(d);
    const ps = projectsFor(d.id, reg.links, projects);
    return (
      <li className={`py-1.5 ${sub ? "ml-4 border-l-2 border-border pl-3" : ""}`}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link to={projectsDossierHref(d.id)} className={`hover:underline break-words ${sub ? "text-sm" : "font-medium"}`}>{d.name}</Link>
          <span className="text-xs text-muted-foreground">{ref ?? "Geen expliciete jaarplanvermelding"}</span>
        </div>
        {ps.length > 0 && (
          <p className="text-xs break-words">
            {ps.map((p, i) => <span key={p.id}>{i > 0 && " · "}<Link to={`/projecten?project=${p.id}`} className="text-brand-red hover:underline">{p.title}</Link></span>)}
          </p>
        )}
      </li>
    );
  };
  return (
    <details className="rounded-md border border-border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium">Dossiers en projecten <span className="text-xs font-normal text-muted-foreground">(alleen beheerders)</span></summary>
      <ul className="mt-2 divide-y divide-border/60">
        {tree.map((d) => (
          <div key={d.id}>
            <Item d={d} />
            {d.children.map((c) => <Item key={c.id} d={c} sub />)}
          </div>
        ))}
      </ul>
    </details>
  );
}
