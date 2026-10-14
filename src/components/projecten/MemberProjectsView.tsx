import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, FolderKanban, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { presentText } from "@/lib/presentText";
import { newestFirst } from "@/lib/projectPlan";
import { statusDateLabel } from "@/lib/statusDate";
import type { ProjectStatus } from "@/lib/internalWork";
import { ProjectStatusBadge, surfaceCls } from "@/components/projecten/ui";

/**
 * Alleen-lezen ledenweergave. Leest uitsluitend de smalle RPC `get_member_project_status`
 * (id, titel, status, statusdatum, omschrijving, Verloop-items); nooit de interne tabellen.
 */
export type MemberProject = {
  id: string; title: string; status: ProjectStatus; status_date: string | null; description: string | null;
  timeline: { date: string; title: string; text: string }[];
};

export const memberProjectsKey = ["member-project-status"] as const;

export function useMemberProjects() {
  return useQuery({
    queryKey: memberProjectsKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_member_project_status");
      if (error) throw error;
      return (data ?? []) as MemberProject[];
    },
    staleTime: 60_000,
  });
}

export default function MemberProjectsView({ preview }: { preview?: React.ReactNode }) {
  const q = useMemberProjects();
  const [sp, setSp] = useSearchParams();
  const openId = sp.get("project");
  const open = (id: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (id) n.set("project", id); else n.delete("project"); return n; });
  const current = openId ? q.data?.find((p) => p.id === openId) : undefined;

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-5 sm:px-6 sm:py-6">
      {preview}
      {!openId && (
        <header className="min-w-0 space-y-1">
          <h1 className="!font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-[28px] sm:leading-9">Projecten</h1>
          <p className="text-sm text-muted-foreground">Stand van zaken en verloop van de lopende projecten van de BCD</p>
        </header>
      )}

      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Projecten laden...</p>
      ) : q.error ? (
        <div role="alert" className="flex flex-wrap items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>De projecten konden niet worden geladen.</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => q.refetch()}>Opnieuw</Button>
        </div>
      ) : openId ? (
        current ? <MemberProjectDetail project={current} onBack={() => open(null)} /> : (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <p>Dit project bestaat niet (meer) of is niet beschikbaar.</p>
            <Button variant="outline" size="sm" onClick={() => open(null)}>Alle projecten</Button>
          </div>
        )
      ) : (q.data ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Er zijn nog geen projecten.</p>
      ) : (
        <ul className={`${surfaceCls} divide-y divide-border overflow-hidden`}>
          {q.data!.map((p) => {
            const desc = presentText(p.description).trim();
            return (
              <li key={p.id}>
                <button type="button" onClick={() => open(p.id)}
                  className="flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-brand-navy" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium text-foreground break-words">{p.title}</span>
                    <span className="block text-[12px] text-muted-foreground">{statusDateLabel(p.status_date)}</span>
                    {desc && <span className="line-clamp-2 block text-[13px] text-muted-foreground whitespace-pre-line">{desc}</span>}
                  </span>
                  <ProjectStatusBadge status={p.status} />
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MemberProjectDetail({ project: p, onBack }: { project: MemberProject; onBack: () => void }) {
  const desc = presentText(p.description).trim();
  const items = newestFirst(p.timeline ?? []);
  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-2">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Alle projecten
        </button>
        <h1 className="!font-sans text-2xl font-semibold tracking-tight text-foreground break-words sm:text-[28px] sm:leading-9">{p.title}</h1>
      </div>

      <section className={`${surfaceCls} border-l-4 border-l-brand-navy p-4 sm:p-5 space-y-2`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="!font-sans text-base font-semibold text-foreground">Huidige status</h2>
          <ProjectStatusBadge status={p.status} />
          <span className="text-[12px] text-muted-foreground">{statusDateLabel(p.status_date)}</span>
        </div>
        {desc ? <p className="whitespace-pre-line text-sm text-foreground">{desc}</p>
          : <p className="text-sm text-muted-foreground">Nog geen huidige status vastgelegd.</p>}
      </section>

      <section className={`${surfaceCls} p-4 sm:p-5 space-y-3`}>
        <h2 className="!font-sans text-base font-semibold text-foreground">Verloop</h2>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen verloop vastgelegd.</p> : (
          <ol className="space-y-4">
            {items.map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-primary" : "bg-border"}`} />
                <div className="min-w-0 space-y-0.5">
                  <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[12px] tabular-nums text-muted-foreground">{it.date}</span>
                  {presentText(it.title).trim() && <p className="text-sm font-medium text-foreground break-words">{presentText(it.title)}</p>}
                  {presentText(it.text).trim() && <p className="whitespace-pre-line text-sm text-muted-foreground break-words">{presentText(it.text)}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
