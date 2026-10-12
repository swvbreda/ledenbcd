import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canPushCompletion, completionSummary, pendingExternalCompletion } from "@/lib/topicalLink";
import { topicalComplete, topicalConfirmSource, topicalConfirmTitle, topicalLookupLists, topicalScan, topicalStatus } from "@/lib/topical.functions";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Onbekende fout");
type ScanResult = Awaited<ReturnType<typeof topicalScan>>;

export default function TopicalPanel({ tasks, onChanged }: { tasks: { id: string; title: string; status: string }[]; onChanged?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const statusFn = useServerFn(topicalStatus);
  const lookupFn = useServerFn(topicalLookupLists);
  const confirmFn = useServerFn(topicalConfirmSource);
  const scanFn = useServerFn(topicalScan);
  const titleFn = useServerFn(topicalConfirmTitle);
  const completeFn = useServerFn(topicalComplete);
  const linksQ = useQuery({
    queryKey: ["topical-links", user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("topical_task_links").select("task_id,todo_task_id,planner_task_id,todo_completed_at,planner_completed_at,last_error");
      if (error) throw error;
      return data as { task_id: string; todo_task_id: string | null; planner_task_id: string | null; todo_completed_at: string | null; planner_completed_at: string | null; last_error: string | null }[];
    },
  });
  const [pushMsg, setPushMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const push = useMutation({
    mutationFn: (taskId: string) => completeFn({ data: { taskId } }),
    onSuccess: (r, id) => { setPushMsg((m) => ({ ...m, [id]: completionSummary(r) })); qc.invalidateQueries({ queryKey: ["topical-links"] }); refresh(); onChanged?.(); },
    onError: (e, id) => setPushMsg((m) => ({ ...m, [id]: { ok: false, text: errMsg(e) } })),
  });
  const statusQ = useQuery({ queryKey: ["topical-status", user?.id], queryFn: () => statusFn(), enabled: !!user?.id });
  const [email, setEmail] = useState("simone@coffeeshopbond.nl");
  const [found, setFound] = useState<Awaited<ReturnType<typeof topicalLookupLists>> | null>(null);
  const [listId, setListId] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["topical-status"] });
  const title = (id: string) => tasks.find((t) => t.id === id)?.title ?? id;

  const lookup = useMutation({
    mutationFn: () => lookupFn({ data: { email } }),
    onSuccess: (r) => { setFound(r); setError(null); setListId(r.lists.find((l) => l.name === "Taken")?.id ?? ""); },
    onError: (e) => setError(errMsg(e)),
  });
  const confirm = useMutation({
    mutationFn: () => confirmFn({ data: { entraId: found!.entraId, display: found!.display, listId, confirm: true } }),
    onSuccess: (r) => { toast.success(`Lijst "${r.listName}" bevestigd`); setError(null); refresh(); },
    onError: (e) => setError(errMsg(e)),
  });
  const runScan = useMutation({
    mutationFn: () => scanFn(),
    onSuccess: (r) => { setScan(r); setError(null); refresh(); },
    onError: (e) => setError(errMsg(e)),
  });
  const confirmTitle = useMutation({
    mutationFn: (v: { taskId: string; todoId: string }) => titleFn({ data: { ...v, confirm: true } }),
    onSuccess: () => { toast.success("Handmatig gekoppeld"); refresh(); runScan.mutate(); },
    onError: (e) => setError(errMsg(e)),
  });

  const s = statusQ.data;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Topical-acties ↔ Microsoft To Do en Planner</h3>
          {s && <Badge variant={s.canWrite ? "default" : "destructive"}>{s.canWrite ? "Schrijfrecht aanwezig" : s.canRead ? "Alleen lezen" : "Geen To Do/Planner-toegang"}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Afronden van een Topical-actie zet de originele To Do-taak op voltooid en de bestaande Planner-taak op 100%. Topical verwerkt dit via de eigen To Do-koppeling; of Topical het echt heeft overgenomen is vanuit Microsoft niet te controleren. Er worden nooit nieuwe taken aangemaakt.
        </p>
        {statusQ.isLoading ? <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Status laden…</p>
          : statusQ.error ? <p className="text-sm text-destructive">{errMsg(statusQ.error)}</p>
          : s && (
            <div className="text-sm space-y-1">
              <p>{s.total} Topical-acties · To Do gekoppeld: {s.todoLinked} · Planner gekoppeld: {s.plannerLinked}</p>
              <p>Bron: {s.source ? `${s.source.account_display ?? "account"} — lijst "${s.source.list_name ?? "?"}"` : "nog niet bevestigd"}</p>
              <p className="text-muted-foreground">Microsoft-rechten: {s.roles.length ? s.roles.join(", ") : "geen"}</p>
              {s.error && <p className="text-destructive">{s.error}</p>}
              {!s.canWrite && (
                <p className="flex gap-2 text-destructive"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Zolang het applicatierecht Tasks.ReadWrite.All (met beheerderstoestemming) ontbreekt, kan Topical-afronden niet doorwerken en blijven deze taken lokaal open.</p>
              )}
            </div>
          )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="font-medium">1. Microsoft-account en To Do-lijst bevestigen</h4>
        <p className="text-xs text-muted-foreground">Wisselen naar een ander account (bijv. ander bestuurslid) geldt alleen voor nieuwe koppelingen; bestaande koppelingen houden hun eigen account en lijst.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Microsoft-account" />
          <Button variant="outline" onClick={() => lookup.mutate()} disabled={lookup.isPending}>{lookup.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Lijsten ophalen</Button>
        </div>
        {found && (
          <div className="space-y-2">
            <Label>Lijst van {found.display}</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger><SelectValue placeholder="Kies lijst" /></SelectTrigger>
              <SelectContent>{found.lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => confirm.mutate()} disabled={!listId || confirm.isPending}>Deze lijst bevestigen</Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="font-medium">2. Koppelingen zoeken</h4>
        <p className="text-sm text-muted-foreground">Alleen een unieke bron-id wordt automatisch gekoppeld. Planner wordt uitsluitend in het vaste plan op bron-id in de notitie gezocht.</p>
        <Button variant="outline" onClick={() => runScan.mutate()} disabled={runScan.isPending || !s?.source}>
          {runScan.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Zoeken en unieke matches koppelen
        </Button>
        {scan && (
          <div className="text-sm space-y-2">
            <p>Bron: {scan.account ?? "account"} — lijst "{scan.listName ?? "?"}"</p>
            <p>To Do-taken gelezen: {scan.todoTotal} · Planner-taken: {scan.plannerTotal} · automatisch gekoppeld: To Do {scan.autoTodo}, Planner {scan.autoPlanner}</p>
            {scan.detailsFailed > 0 && <p className="text-destructive">{scan.detailsFailed} Planner-notities konden niet gelezen worden; die taken zijn niet gekoppeld.</p>}
            {scan.plannerMissing.length > 0 && <p className="text-destructive">Geen unieke Planner-taak voor: {scan.plannerMissing.map((m) => `${title(m.taskId)}${m.kind === "ambiguous" ? ` (${m.count} kandidaten)` : ""}`).join("; ")}</p>}
            {scan.review.map((r) => (
              <div key={r.taskId} className="rounded border border-border p-2 space-y-1">
                <p className="font-medium">{title(r.taskId)}</p>
                <p className="text-muted-foreground">{r.kind === "none" ? "Geen kandidaat in To Do." : r.kind === "ambiguous" ? "Meerdere To Do-taken dragen deze bron-id; niet automatisch gekoppeld." : "Alleen titel komt overeen — handmatig bevestigen."}</p>
                {r.kind === "title_only" && r.candidates.map((c) => (
                  <Button key={c.id} size="sm" variant="outline" className="h-auto whitespace-normal text-left" disabled={confirmTitle.isPending} onClick={() => confirmTitle.mutate({ taskId: r.taskId, todoId: c.id })}>Koppel aan "{c.title}" · {c.status || "status onbekend"} · {c.due ? `deadline ${c.due}` : "geen deadline"} · id …{c.id.slice(-8)}</Button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="font-medium">Eerder lokaal afgerond, nog niet extern bevestigd</h4>
        {linksQ.isLoading ? <p className="text-sm text-muted-foreground">Laden…</p>
          : linksQ.error ? <p className="text-sm text-destructive">{errMsg(linksQ.error)}</p>
          : (() => {
            const pending = pendingExternalCompletion(tasks, linksQ.data ?? []);
            if (!pending.length) return <p className="text-sm text-muted-foreground">Geen.</p>;
            return (
              <>
                <p className="text-sm text-muted-foreground">Deze {pending.length} acties staan lokaal op afgerond, maar To Do en Planner zijn niet bevestigd. Ze zijn dus nog niet overal afgerond.</p>
                <ul className="space-y-2">
                  {pending.map((t) => {
                    const l = linksQ.data?.find((x) => x.task_id === t.id);
                    const ok = canPushCompletion(!!s?.canWrite, l);
                    const why = !s?.canWrite ? "Wacht op Microsoft-recht Tasks.ReadWrite.All (beheerderstoestemming)." : !l?.todo_task_id ? "To Do-taak nog niet gekoppeld." : !l?.planner_task_id ? "Planner-taak nog niet gekoppeld." : null;
                    return (
                      <li key={t.id} className="rounded border border-border p-2 space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <p className="flex-1 break-words text-sm font-medium">{t.title}</p>
                          <Button size="sm" variant="outline" disabled={!ok || push.isPending} onClick={() => push.mutate(t.id)}>
                            {push.isPending && push.variables === t.id && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Afronding doorzetten
                          </Button>
                        </div>
                        {why && <p className="text-xs text-muted-foreground">{why}</p>}
                        {(pushMsg[t.id] || l?.last_error) && <p role="status" className={`text-xs ${pushMsg[t.id]?.ok ? "text-muted-foreground" : "text-destructive"}`}>{pushMsg[t.id]?.text ?? l?.last_error}</p>}
                      </li>
                    );
                  })}
                </ul>
              </>
            );
          })()}
      </div>
      {error && <p role="alert" className="text-sm text-destructive flex gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}</p>}
    </div>
  );
}
