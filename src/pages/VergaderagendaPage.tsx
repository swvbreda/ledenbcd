import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDossierRegister } from "@/hooks/useDossierRegister";
import { ProjectStatusBadge } from "@/components/projecten/ui";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, Printer, RefreshCw } from "lucide-react";
import { AGENDA_ITEMS, BESLUITENREGISTER_URL, NOT_SET, TEAMS_ARCHIEF_PAD, buildAgenda, nextFilterParams, type AgendaProject, type AgendaTask } from "@/lib/meetingAgenda";
import { fmtStatusDate, statusDateLabel } from "@/lib/statusDate";
import { displayName, type StaffMember } from "@/lib/projectWorkspace";

const db = supabase as any;
const ALL = "";
/** Zolang het venster open/zichtbaar is: elke minuut verversen, zodat wijzigingen uit andere vensters binnenkomen. */
export const AGENDA_REFRESH_MS = 60_000;
const hhmm = (t: number) => new Date(t).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function VergaderagendaPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Laden...</p>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <AgendaInner />;
}

function AgendaInner() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [sp, setSp] = useSearchParams();
  const projectId = sp.get("project") || null;
  const dossierId = sp.get("dossier") || null;
  const [showDone, setShowDone] = useState(false);
  const setFilter = (k: "project" | "dossier", v: string) => setSp((p) => nextFilterParams(p, k, v), { replace: true });

  // Zelfde querykeys als Projecten & taken: elke wijziging daar ververst deze agenda.
  const opts = { enabled: !!uid, refetchOnWindowFocus: true, staleTime: 0, refetchInterval: AGENDA_REFRESH_MS, refetchIntervalInBackground: false } as const;
  const projectsQ = useQuery({ ...opts, queryKey: ["internal-projects", uid], queryFn: async () => {
    const { data, error } = await db.from("internal_projects").select("*").order("created_at", { ascending: false });
    if (error) throw error; return data as AgendaProject[];
  } });
  const tasksQ = useQuery({ ...opts, queryKey: ["internal-tasks", uid], queryFn: async () => {
    const { data, error } = await db.from("internal_tasks").select("*").order("deadline", { ascending: true, nullsFirst: false });
    if (error) throw error; return data as AgendaTask[];
  } });
  const staffQ = useQuery({ ...opts, queryKey: ["internal-staff", uid], queryFn: async () => {
    const { data, error } = await db.rpc("list_internal_staff_names");
    if (error) throw error; return data as StaffMember[];
  } });
  const reg = useDossierRegister(true, { refetchInterval: AGENDA_REFRESH_MS });

  const agenda = useMemo(() => buildAgenda(projectsQ.data ?? [], tasksQ.data ?? [], reg.links, reg.dossiers, { projectId, dossierId }),
    [projectsQ.data, tasksQ.data, reg.links, reg.dossiers, projectId, dossierId]);
  const staff = (id: string | null) => {
    if (!id) return NOT_SET;
    if (staffQ.error) return "Naam niet geladen";
    return displayName(staffQ.data?.find((s) => s.user_id === id));
  };
  const coreError = projectsQ.error || tasksQ.error || reg.error;
  const loadingAny = projectsQ.isLoading || tasksQ.isLoading || reg.isLoading || staffQ.isLoading;
  const fetchingAny = projectsQ.isFetching || tasksQ.isFetching || staffQ.isFetching;
  const fetchedAt = Math.min(projectsQ.dataUpdatedAt || Infinity, tasksQ.dataUpdatedAt || Infinity, reg.updatedAt);
  const today = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const projName = projectsQ.data?.find((p) => p.id === projectId)?.title;
  const dosName = reg.dossiers.find((d) => d.id === dossierId)?.name;
  const refresh = () => { projectsQ.refetch(); tasksQ.refetch(); staffQ.refetch(); reg.refetch(); };
  const openProjects = (projectsQ.data ?? []).filter((p) => !p.archived_at).sort((a, b) => a.title.localeCompare(b.title));
  const dossiers = reg.dossiers.filter((d) => !d.archived_at);
  const filterParts = [
    projectId && `project ${projName ?? "(ongeldig of verouderd)"}`,
    dossierId && `dossier ${dosName ?? "(ongeldig of verouderd)"}`,
  ].filter(Boolean);

  const taskList = (ts: AgendaTask[]) => ts.length === 0
    ? <p className="text-sm text-muted-foreground">Geen open acties.</p>
    : <ul className="space-y-1 text-sm">{ts.map((t) => (
        <li key={t.id} className="flex flex-wrap gap-x-2"><span className="break-words">{t.title}</span>
          <span className="text-muted-foreground">— {staff(t.assignee_id)}{t.deadline ? `, deadline ${fmtStatusDate(t.deadline) ?? t.deadline}` : ", geen deadline"}</span></li>))}</ul>;

  const projectBlock = (r: (typeof agenda.active)[number]) => (
    <article key={r.project.id} className="break-inside-avoid space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/projecten?project=${r.project.id}`} className="font-semibold text-primary hover:underline">{r.project.title}</Link>
        <ProjectStatusBadge status={r.project.status} />
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr] print:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Stand</dt><dd className="whitespace-pre-wrap break-words">{r.stand ?? NOT_SET} <span className="text-muted-foreground">({statusDateLabel(r.project.status_date)})</span></dd>
        <dt className="text-muted-foreground">Planning</dt><dd className="whitespace-pre-wrap break-words">{r.project.planning?.trim() || NOT_SET}{r.project.planning_date ? ` (${fmtStatusDate(r.project.planning_date) ?? r.project.planning_date})` : ""}</dd>
        <dt className="text-muted-foreground">Verantwoordelijke</dt><dd>{staff(r.project.owner_id)}</dd>
      </dl>
      <div><p className="text-xs font-medium uppercase text-muted-foreground">Open acties</p>{taskList(r.openTasks)}</div>
    </article>
  );

  return (
    <div className="w-full min-w-0 space-y-5 px-4 py-5 sm:px-6 print:p-0">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="!font-sans text-2xl font-semibold tracking-tight">Vergaderagenda</h1>
          <p className="text-sm text-muted-foreground">
            Peildatum {today} · gegevens opgehaald {Number.isFinite(fetchedAt) ? hhmm(fetchedAt) : "—"}
            <span className="print:hidden">{fetchingAny ? " · bezig met verversen…" : " · ververst elke minuut zolang dit venster open is"}</span>
          </p>
          <p className="text-sm">Filter: {filterParts.length ? filterParts.join(" en ") : "alle projecten"}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" asChild><Link to="/projecten">Projecten & taken</Link></Button>
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="mr-1 h-4 w-4" />Verversen</Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Afdrukken</Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3 print:hidden">
        <label className="text-sm">Project{" "}
          <select aria-label="Project" className="ml-1 min-h-9 max-w-[16rem] rounded-md border border-input bg-background px-2" value={projectId ?? ALL} onChange={(e) => setFilter("project", e.target.value)}>
            <option value={ALL}>Alle projecten</option>
            {agenda.invalidProject && <option value={projectId!}>Ongeldige selectie</option>}
            {openProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select></label>
        <label className="text-sm">Dossier{" "}
          <select aria-label="Dossier" className="ml-1 min-h-9 max-w-[16rem] rounded-md border border-input bg-background px-2" value={dossierId ?? ALL} onChange={(e) => setFilter("dossier", e.target.value)}>
            <option value={ALL}>Alle dossiers</option>
            {agenda.invalidDossier && <option value={dossierId!}>Ongeldige selectie</option>}
            {dossiers.map((d) => <option key={d.id} value={d.id}>{d.parent_id ? "— " : ""}{d.name}</option>)}
          </select></label>
      </div>

      <p className="text-xs text-muted-foreground print:hidden">Afgeleid uit de projecten en taken in dit ledenbestand. Wijzigingen die nog niet uit Teams/Outlook zijn geïmporteerd staan hier niet in.</p>

      {coreError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Projecten, taken of dossierkoppelingen konden niet worden geladen; deze agenda is onvolledig en wordt niet getoond. Probeer Verversen.</span>
        </div>
      )}
      {staffQ.error && !coreError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Namen van verantwoordelijken konden niet worden geladen; daar staat "Naam niet geladen".</span>
        </div>
      )}
      {!loadingAny && !coreError && agenda.invalid && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Ongeldige selectie: {[agenda.invalidProject && "het gekozen project", agenda.invalidDossier && "het gekozen dossier"].filter(Boolean).join(" en ")} bestaat niet (meer) of is gearchiveerd. Er worden geen andere gegevens getoond; kies opnieuw een filter.</span>
        </div>
      )}
      {loadingAny ? <p className="text-sm text-muted-foreground">Laden...</p> : coreError || agenda.invalid ? null : (
        <ol className="space-y-5">
          {AGENDA_ITEMS.map((title, i) => (
            <li key={title} className="space-y-2 break-inside-avoid-page">
              <h2 className="!font-sans text-lg font-semibold">{i + 1}. {title}</h2>
              {i === 1 && <>
                <div className="space-y-1 text-sm">
                  <p>Notulen en besluiten staan in Microsoft:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li><a href={BESLUITENREGISTER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">BCD Besluitenregister (SharePoint)<ExternalLink className="h-3 w-3 print:hidden" /></a></li>
                    <li>Notulen: Teams → {TEAMS_ARCHIEF_PAD}</li>
                  </ul>
                </div>
                {agenda.openActionCount === 0 ? <p className="text-sm text-muted-foreground">Geen openstaande acties.</p>
                  : <p className="text-sm">{agenda.openActionCount} openstaande actie(s); zie per project onder punt 3.</p>}
                {agenda.unscoped.length > 0 && <div><p className="text-xs font-medium uppercase text-muted-foreground">Acties zonder project</p>{taskList(agenda.unscoped)}</div>}
              </>}
              {i === 2 && <>
                {agenda.active.length === 0 && <p className="text-sm text-muted-foreground">Geen lopende projecten binnen dit filter.</p>}
                <div className="space-y-3">{agenda.active.map(projectBlock)}</div>
                {agenda.completed.length > 0 && (
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" className="print:hidden" onClick={() => setShowDone((v) => !v)}>{showDone ? "Verberg" : "Toon"} afgeronde projecten ({agenda.completed.length})</Button>
                    <div className={showDone ? "space-y-3" : "hidden print:block print:space-y-3"}>
                      <p className="hidden text-xs font-medium uppercase text-muted-foreground print:block">Afgeronde projecten ({agenda.completed.length})</p>
                      {agenda.completed.map(projectBlock)}
                    </div>
                  </div>
                )}
              </>}
              {i === 3 && (agenda.active.length === 0 ? <p className="text-sm text-muted-foreground">{NOT_SET}</p> : (
                <ul className="space-y-2 text-sm">{agenda.active.map((r) => (
                  <li key={r.project.id}><span className="font-medium">{r.project.title}:</span>{" "}
                    {r.points.length ? <span className="whitespace-pre-wrap break-words">{r.points.join("\n")}</span> : <span className="text-muted-foreground">{NOT_SET}</span>}</li>))}</ul>
              ))}
              {i === 4 && <p className="text-sm text-muted-foreground">Nieuwe acties en datum volgende vergadering: in de vergadering vast te leggen.</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
