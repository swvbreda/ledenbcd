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
  plannerConfirmUser, plannerCreateBucket, plannerLinkProject, plannerLookupUser,
  plannerResolveConflict, plannerResolveUncertain, plannerStatus, plannerSyncProject, plannerTargetPlan,
} from "@/lib/planner.functions";
import { plannerReadiness } from "@/lib/plannerStatus";
import OutlookDeadlinesPanel from "./OutlookDeadlinesPanel";

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
  const targetFn = useServerFn(plannerTargetPlan);
  const mkBucketFn = useServerFn(plannerCreateBucket);
  const uncertainFn = useServerFn(plannerResolveUncertain);
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
      const { data, error } = await db.from("planner_sync_log").select("project_id,started_at,finished_at,ok,outcome,warnings,created_remote,updated_remote,updated_local,conflicts,error").order("started_at", { ascending: false }).limit(10);
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
  const [bucketId, setBucketId] = useState("");
  const [bucketName, setBucketName] = useState("");
  const targetQ = useQuery({ queryKey: ["planner-target", uid], enabled: !!uid && ready.canRead, queryFn: () => targetFn(), retry: 0 });
  const targetOk = !!targetQ.data?.ok;
  const buckets = targetQ.data?.ok ? targetQ.data.buckets : [];
  const usedBuckets = new Set((linksQ.data ?? []).filter((l) => l.project_id !== projectId).map((l) => l.bucket_id as string));
  const link = useMutation({
    mutationFn: () => linkFn({ data: { projectId, planId: targetQ.data!.planId, bucketId } }),
    onSuccess: (r) => { toast.success(`Gekoppeld aan bucket "${r.bucketName}"`); setBucketId(""); refreshAll(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const mkBucket = useMutation({
    mutationFn: () => mkBucketFn({ data: { name: bucketName.trim(), confirm: true } }),
    onSuccess: (b) => { toast.success(`Bucket "${b.name}" aangemaakt`); setBucketName(""); setBucketId(b.id); qc.invalidateQueries({ queryKey: ["planner-target"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const uncertainFix = useMutation({
    mutationFn: (taskId: string) => uncertainFn({ data: { taskId, action: "retry_create" } }),
    onSuccess: () => { toast.success("Wordt bij volgende synchronisatie opnieuw aangemaakt"); refreshAll(); },
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
      setSyncErr((m) => ({ ...m, [pid]: r.outcome === "partial" ? `Gedeeltelijk: ${r.conflicts} conflict(en), ${r.warnings.length} waarschuwing(en) — zie log.` : "" }));
      (r.outcome === "partial" ? toast.warning : toast.success)(`Planner: ${r.created} aangemaakt, ${r.imported} overgenomen, ${r.updatedRemote} bijgewerkt in Planner, ${r.updatedLocal} lokaal, ${r.conflicts} conflicten`);
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
      if (!projects.some((p) => p.id === l.project_id) || !l.bucket_id) continue; // gearchiveerd of zonder bucket: niet automatisch
      const last = l.last_sync_at ? Date.parse(l.last_sync_at) : 0;
      if (Date.now() - last > AUTO_SYNC_MS) sync.mutate(l.project_id);
    }
  }, [ready.canWrite, linksQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkOf = (pid: string) => linksQ.data?.find((l) => l.project_id === pid);
  const conflicts = (taskLinksQ.data ?? []).filter((l) => l.state === "conflict");
  const uncertain = (taskLinksQ.data ?? []).filter((l) => l.state === "uncertain");
  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title ?? "Taak";

  return (
    <div className="space-y-4">
      <OutlookDeadlinesPanel tasks={tasks} />
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
        <h2 className="font-display uppercase tracking-tight">Project koppelen aan bucket in plan "To do"</h2>
        <p className="text-xs text-muted-foreground">Doelplan is vastgesteld: "To do" in team Bond van Cannabis Detailisten. Elk project krijgt een eigen bucket; alleen taken in die bucket worden gesynchroniseerd.</p>
        {!ready.canRead ? <p className="text-sm text-muted-foreground">Plan kan pas gelezen worden zodra Planner-rechten zijn toegekend.</p>
          : targetQ.isLoading ? <p className="text-sm text-muted-foreground">Plan laden…</p>
          : targetQ.data && !targetQ.data.ok ? <p className="text-sm text-destructive">Plan niet leesbaar: {targetQ.data.error}</p>
          : targetQ.error ? <p className="text-sm text-destructive">{errMsg(targetQ.error)}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Kies project" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Bucket</Label>
            <Select value={bucketId} onValueChange={setBucketId} disabled={!buckets.length}>
              <SelectTrigger><SelectValue placeholder={buckets.length ? "Kies bucket" : "Geen buckets"} /></SelectTrigger>
              <SelectContent>{buckets.map((b) => <SelectItem key={b.id} value={b.id} disabled={usedBuckets.has(b.id)}>{b.name}{usedBuckets.has(b.id) ? " (al gekoppeld)" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <Button disabled={!targetOk || !projectId || !bucketId || link.isPending} onClick={() => link.mutate()}>
            {link.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Koppelen
          </Button>
          <Input className="max-w-xs" placeholder="Naam nieuwe bucket" value={bucketName} onChange={(e) => setBucketName(e.target.value)} />
          <Button variant="outline" disabled={!targetOk || !ready.canWrite || !bucketName.trim() || mkBucket.isPending}
            onClick={() => { if (window.confirm(`Bucket "${bucketName.trim()}" aanmaken in Planner-plan "To do"?`)) mkBucket.mutate(); }}>
            Bucket aanmaken in Planner
          </Button>
        </div>
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
                    <span className="text-sm text-muted-foreground">→ {l.plan_title ?? "plan"} / {l.bucket_name ?? "geen bucket"}</span>
                    {l.last_outcome === "partial" && <Badge variant="outline">Gedeeltelijk</Badge>}
                    <Button size="sm" variant="outline" className="ml-auto" disabled={!ready.canWrite || busy || !p || !l.bucket_id} onClick={() => sync.mutate(l.project_id)}>
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

      {uncertain.length > 0 && (
        <section className="rounded-lg border border-destructive/40 bg-card p-4 space-y-2">
          <h2 className="font-display uppercase tracking-tight">Onzeker aangemaakt</h2>
          <p className="text-xs text-muted-foreground">Microsoft gaf geen zeker antwoord. Controleer eerst in Planner of de taak bestaat; kies alleen "opnieuw aanmaken" als hij er zeker niet is.</p>
          {uncertain.map((c) => (
            <div key={c.task_id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1">{titleOf(c.task_id)} — {c.last_error}</span>
              <Button size="sm" variant="outline" disabled={uncertainFix.isPending} onClick={() => { if (window.confirm("Bevestig: deze taak staat zeker niet in Planner.")) uncertainFix.mutate(c.task_id); }}>Opnieuw aanmaken</Button>
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
                {new Date(r.started_at).toLocaleString("nl-NL")} — {r.ok == null ? "bezig/onderbroken" : r.outcome === "partial" ? `gedeeltelijk: ${r.created_remote} aangemaakt, ${r.updated_remote} naar Planner, ${r.updated_local} lokaal, ${r.conflicts} conflicten, ${r.warnings} waarschuwingen` : r.ok ? `ok: ${r.created_remote} aangemaakt, ${r.updated_remote} naar Planner, ${r.updated_local} lokaal, ${r.conflicts} conflicten` : `fout: ${r.error}`}
                {r.ok !== false && r.error ? <span className="block text-xs text-muted-foreground whitespace-pre-wrap">{r.error}</span> : null}
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
