import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import {
  plannerConfirmUser, plannerLinkProject, plannerListGroups, plannerListPlans, plannerLookupUser,
  plannerResolveConflict, plannerStatus, plannerSyncProject,
} from "@/lib/planner.functions";
import { plannerReadiness } from "@/lib/plannerStatus";

const db = supabase as any;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Onbekende fout");
const AUTO_SYNC_MS = 10 * 60_000;

type Props = {
  projects: { id: string; title: string }[];
  staff: { user_id: string; email: string }[];
  tasks: { id: string; title: string; project_id: string | null }[];
  onSynced: () => void;
};

export default function PlannerPanel({ projects, staff, tasks, onSynced }: Props) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const qc = useQueryClient();
  const statusFn = useServerFn(plannerStatus);
  const groupsFn = useServerFn(plannerListGroups);
  const plansFn = useServerFn(plannerListPlans);
  const linkFn = useServerFn(plannerLinkProject);
  const lookupFn = useServerFn(plannerLookupUser);
  const confirmFn = useServerFn(plannerConfirmUser);
  const syncFn = useServerFn(plannerSyncProject);
  const resolveFn = useServerFn(plannerResolveConflict);

  const statusQ = useQuery({ queryKey: ["planner-status", uid], enabled: !!uid, queryFn: () => statusFn(), staleTime: 60_000, retry: 1 });
  const linksQ = useQuery({
    queryKey: ["planner-links", uid], enabled: !!uid,
    queryFn: async () => { const { data, error } = await db.from("planner_project_links").select("*"); if (error) throw error; return data as any[]; },
  });
  const usersQ = useQuery({
    queryKey: ["planner-users", uid], enabled: !!uid,
    queryFn: async () => { const { data, error } = await db.from("planner_user_map").select("*"); if (error) throw error; return data as any[]; },
  });
  const taskLinksQ = useQuery({
    queryKey: ["planner-task-links", uid], enabled: !!uid,
    queryFn: async () => { const { data, error } = await db.from("planner_task_links").select("task_id,state,last_error"); if (error) throw error; return data as any[]; },
  });
  const logQ = useQuery({
    queryKey: ["planner-log", uid], enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await db.from("planner_sync_log").select("project_id,started_at,finished_at,ok,created_remote,updated_remote,updated_local,conflicts,error").order("started_at", { ascending: false }).limit(10);
      if (error) throw error; return data as any[];
    },
  });

  const st = statusQ.data;
  const ready = plannerReadiness(st ?? null);
  const refreshAll = () => {
    for (const k of ["planner-links", "planner-users", "planner-task-links", "planner-log"]) qc.invalidateQueries({ queryKey: [k] });
    onSynced();
  };

  // --- planselectie ---
  const [projectId, setProjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [planId, setPlanId] = useState("");
  const groupsQ = useQuery({ queryKey: ["planner-groups", uid], enabled: !!uid && !!st?.canListGroups, queryFn: () => groupsFn(), retry: 0 });
  const plansQ = useQuery({
    queryKey: ["planner-plans", uid, groupId], enabled: !!uid && ready.canRead && /^[0-9a-fA-F-]{36}$/.test(groupId),
    queryFn: () => plansFn({ data: { groupId } }), retry: 0,
  });
  const link = useMutation({
    mutationFn: () => linkFn({ data: { projectId, groupId, planId } }),
    onSuccess: (r) => { toast.success(`Gekoppeld aan plan "${r.planTitle}"`); setPlanId(""); refreshAll(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  // --- personen ---
  const [lookup, setLookup] = useState<Record<string, { entraId: string; displayName: string } | string>>({});
  const doLookup = useMutation({
    mutationFn: async (s: { user_id: string; email: string }) => ({ s, r: await lookupFn({ data: { email: s.email } }) }),
    onSuccess: ({ s, r }) => setLookup((m) => ({ ...m, [s.user_id]: r.found ? { entraId: r.entraId, displayName: r.displayName } : `Niet gevonden: ${r.error}` })),
    onError: (e) => toast.error(errMsg(e)),
  });
  const confirm = useMutation({
    mutationFn: (v: { userId: string; entraId: string; displayName: string }) => confirmFn({ data: v }),
    onSuccess: () => { toast.success("Microsoft-account gekoppeld"); refreshAll(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  // --- sync ---
  const [syncErr, setSyncErr] = useState<Record<string, string>>({});
  const sync = useMutation({
    mutationFn: (pid: string) => syncFn({ data: { projectId: pid } }),
    onSuccess: (r, pid) => {
      setSyncErr((m) => ({ ...m, [pid]: "" }));
      toast.success(`Planner: ${r.created} aangemaakt, ${r.imported} overgenomen, ${r.updatedRemote} bijgewerkt in Planner, ${r.updatedLocal} lokaal, ${r.conflicts} conflicten`);
      refreshAll();
    },
    onError: (e, pid) => { setSyncErr((m) => ({ ...m, [pid]: errMsg(e) })); refreshAll(); },
  });
  const resolve = useMutation({
    mutationFn: (v: { taskId: string; keep: "local" | "planner" }) => resolveFn({ data: v }),
    onSuccess: () => { toast.success("Keuze opgeslagen; synchroniseer om toe te passen"); refreshAll(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  // Automatisch: bij openen, per gekoppeld project hoogstens elke 10 minuten.
  const autoDone = useRef(false);
  useEffect(() => {
    if (autoDone.current || !ready.canWrite || !linksQ.data) return;
    autoDone.current = true;
    for (const l of linksQ.data) {
      const last = l.last_sync_at ? Date.parse(l.last_sync_at) : 0;
      if (Date.now() - last > AUTO_SYNC_MS) sync.mutate(l.project_id);
    }
  }, [ready.canWrite, linksQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkOf = (pid: string) => linksQ.data?.find((l) => l.project_id === pid);
  const conflicts = (taskLinksQ.data ?? []).filter((l) => l.state === "conflict");
  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title ?? "Taak";

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="font-display uppercase tracking-tight">Microsoft Planner-status</h2>
        {statusQ.isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Rechten controleren…</p>
        ) : statusQ.error ? (
          <p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="h-4 w-4" />{errMsg(statusQ.error)}</p>
        ) : (
          <>
            <p className="text-sm"><Badge variant={ready.level === "ok" ? "default" : "outline"}>{ready.label}</Badge></p>
            <p className="text-sm text-muted-foreground">{ready.detail}</p>
            {st?.configured && <p className="text-xs text-muted-foreground">Aanwezige app-rechten: {st.roles.length ? st.roles.join(", ") : "geen"}</p>}
            {st?.error && <p className="text-sm text-destructive">{st.error}</p>}
          </>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-display uppercase tracking-tight">Project koppelen aan bestaand plan</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Kies project" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Team / groep</Label>
            {groupsQ.data ? (
              <Select value={groupId} onValueChange={(v) => { setGroupId(v); setPlanId(""); }}>
                <SelectTrigger><SelectValue placeholder="Kies team" /></SelectTrigger>
                <SelectContent>{groupsQ.data.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input placeholder="Groeps-ID van het team" value={groupId} onChange={(e) => { setGroupId(e.target.value.trim()); setPlanId(""); }} />
            )}
          </div>
          <div className="space-y-1">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId} disabled={!plansQ.data?.length}>
              <SelectTrigger><SelectValue placeholder={plansQ.isLoading ? "Laden…" : "Kies plan"} /></SelectTrigger>
              <SelectContent>{(plansQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {plansQ.error && <p className="text-sm text-destructive">{errMsg(plansQ.error)}</p>}
        {plansQ.data && plansQ.data.length === 0 && <p className="text-sm text-muted-foreground">Dit team heeft nog geen plannen. Maak het plan eerst zelf aan in Planner.</p>}
        <Button disabled={!ready.canRead || !projectId || !planId || link.isPending} onClick={() => link.mutate()}>
          {link.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Koppelen
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-display uppercase tracking-tight">Gekoppelde projecten</h2>
        {linksQ.isLoading ? <p className="text-sm text-muted-foreground">Laden…</p> : linksQ.error ? (
          <p className="text-sm text-destructive">{errMsg(linksQ.error)}</p>
        ) : !linksQ.data?.length ? <p className="text-sm text-muted-foreground">Nog geen project aan Planner gekoppeld.</p> : (
          <ul className="space-y-2">
            {linksQ.data.map((l) => {
              const p = projects.find((x) => x.id === l.project_id);
              const busy = sync.isPending && sync.variables === l.project_id;
              return (
                <li key={l.project_id} className="rounded-md border border-border p-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p?.title ?? "Project"}</span>
                    <span className="text-sm text-muted-foreground">→ {l.plan_title ?? "plan"}</span>
                    <Button size="sm" variant="outline" className="ml-auto" disabled={!ready.canWrite || busy} onClick={() => sync.mutate(l.project_id)}>
                      {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Nu synchroniseren
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Laatste geslaagde sync: {l.last_success_at ? new Date(l.last_success_at).toLocaleString("nl-NL") : "nog nooit"}
                  </p>
                  {(syncErr[l.project_id] || l.last_error) && <p className="text-sm text-destructive">{syncErr[l.project_id] || l.last_error}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {conflicts.length > 0 && (
        <section className="rounded-lg border border-destructive/40 bg-card p-4 space-y-2">
          <h2 className="font-display uppercase tracking-tight">Conflicten</h2>
          {conflicts.map((c) => (
            <div key={c.task_id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1">{titleOf(c.task_id)} — {c.last_error}</span>
              <Button size="sm" variant="outline" onClick={() => resolve.mutate({ taskId: c.task_id, keep: "local" })}>Ledenbestand aanhouden</Button>
              <Button size="sm" variant="outline" onClick={() => resolve.mutate({ taskId: c.task_id, keep: "planner" })}>Planner aanhouden</Button>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="font-display uppercase tracking-tight">Verantwoordelijken koppelen</h2>
        <p className="text-xs text-muted-foreground">Een BCD-account is geen Microsoft-account. Zoek en bevestig per beheerder het juiste Microsoft-account; zonder koppeling wordt de toewijzing niet verstuurd.</p>
        {staff.map((s) => {
          const m = usersQ.data?.find((u) => u.user_id === s.user_id);
          const l = lookup[s.user_id];
          return (
            <div key={s.user_id} className="flex flex-wrap items-center gap-2 text-sm border-t border-border pt-2">
              <span className="flex-1 break-all">{s.email}</span>
              {m ? <Badge variant="outline">Gekoppeld: {m.entra_display ?? "Microsoft-account"}</Badge> : null}
              {typeof l === "object" ? (
                <Button size="sm" onClick={() => confirm.mutate({ userId: s.user_id, entraId: l.entraId, displayName: l.displayName })}>Bevestig {l.displayName}</Button>
              ) : typeof l === "string" ? <span className="text-destructive">{l}</span> : null}
              <Button size="sm" variant="ghost" disabled={!st?.configured || doLookup.isPending} onClick={() => doLookup.mutate(s)}>Zoek in Microsoft</Button>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="font-display uppercase tracking-tight">Recente synchronisaties</h2>
        {!logQ.data?.length ? <p className="text-sm text-muted-foreground">Nog geen synchronisaties uitgevoerd.</p> : (
          <ul className="text-sm space-y-1">
            {logQ.data.map((r, i) => (
              <li key={i} className={r.ok === false ? "text-destructive" : ""}>
                {new Date(r.started_at).toLocaleString("nl-NL")} — {r.ok == null ? "bezig/onderbroken" : r.ok ? `ok: ${r.created_remote} aangemaakt, ${r.updated_remote} naar Planner, ${r.updated_local} lokaal, ${r.conflicts} conflicten` : `fout: ${r.error}`}
                {r.ok && r.error ? <span className="block text-xs text-muted-foreground whitespace-pre-wrap">{r.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Planner kent alleen 0%, 50% en 100%: "Te doen" = 0%, "Bezig" en "Wacht op iemand" = 50%, "Afgerond" = 100%. Een taak die lokaal op "Wacht op iemand" staat blijft dat zolang Planner op 50% staat.
        Prioriteit: Hoog = Belangrijk, Normaal = Gemiddeld, Laag = Laag. Er wordt niets in Planner verwijderd; archiveren gebeurt alleen lokaal.
      </p>
    </div>
  );
}
