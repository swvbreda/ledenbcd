import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Hand, Loader2, Plus, Trash2, X } from "lucide-react";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL, isOverdue, completeTaskLocally, type ProjectStatus, type TaskPriority, type TaskStatus } from "@/lib/internalWork";
import {
  CHECKPOINT_STATUS_LABEL, NOT_RECORDED, actorLabel, creatorLabel, canClaim, displayName, parseAmount, participantIds,
  projectProgress, type ActorKind, type CheckpointStatus, type MessageKind, type StaffMember,
} from "@/lib/projectWorkspace";
import { StaffAvatars } from "./StaffAvatars";
import { changedText, presentEventSummary, presentText } from "@/lib/presentText";
import { parsePlan } from "@/lib/projectPlan";

const db = supabase as any;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as any)?.message ?? "Onbekende fout");
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" }) : "—");
const eur = (n: number | null) => (n == null ? "Onbekend" : n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" }));
const NONE = "__none";

export type WsProject = {
  id: string; title: string; description: string | null; owner_id: string | null; due_date: string | null; status: ProjectStatus;
  archived_at: string | null; project_plan: string | null; budget_estimate: number | null; budget_reserved: number | null; budget_received: number | null;
  created_by: string | null; created_at: string; created_origin?: "medewerker" | "bronimport" | null;
};
export type WsTask = {
  id: string; title: string; description: string | null; project_id: string | null; assignee_id: string | null; deadline: string | null;
  priority: TaskPriority; status: TaskStatus; source_system?: string | null; created_by: string | null; created_at: string;
  completed_at: string | null; completed_by: string | null; local_only_completed_by?: string | null;
};
type Participant = { project_id: string; user_id: string; added_by: string | null; added_at: string };
type Message = {
  id: string; kind: MessageKind; body: string | null; author_id: string | null; author_kind: ActorKind; created_at: string;
  source_date: string | null; source_subject: string | null; source_mailbox: string | null; source_ref: string | null; last_action: string | null; next_step: string | null;
};
type Checkpoint = { id: string; position: number; title: string; status: CheckpointStatus; owner_id: string | null; due_date: string | null; remarks: string | null; updated_by: string | null; updated_at: string };
type Event = { id: string; event_type: string; summary: string; actor_id: string | null; actor_kind: ActorKind; created_at: string };

interface Props {
  project: WsProject; tasks: WsTask[]; staff: StaffMember[]; participants: Participant[]; uid: string | null;
  onBack: () => void; onChanged: () => void; onEditTask: (t: Partial<WsTask>) => void; onTaskSaved?: (id: string) => void;
}

export default function ProjectWorkspace({ project, tasks, staff, participants, uid, onBack, onChanged, onEditTask }: Props) {
  const qc = useQueryClient();
  const pid = project.id;
  const prog = projectProgress(tasks, pid);
  const people = participantIds(project, tasks, participants);
  const explicit = participants.filter((p) => p.project_id === pid);
  const today = new Date().toISOString().slice(0, 10);
  const projTasks = tasks.filter((t) => t.project_id === pid);
  const byName = (id: string | null) => (id ? displayName(staff.find((s) => s.user_id === id)) : "—");

  const messagesQ = useQuery({
    queryKey: ["project-messages", uid, pid],
    queryFn: async () => {
      const { data, error } = await db.from("internal_project_messages").select("*").eq("project_id", pid).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Message[];
    },
  });
  const checkpointsQ = useQuery({
    queryKey: ["project-checkpoints", uid, pid],
    queryFn: async () => {
      const { data, error } = await db.from("internal_project_checkpoints").select("*").eq("project_id", pid).order("position").order("created_at");
      if (error) throw error;
      return data as Checkpoint[];
    },
  });
  const eventsQ = useQuery({
    queryKey: ["project-events", uid, pid],
    queryFn: async () => {
      const { data, error } = await db.from("internal_project_events").select("*").eq("project_id", pid).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as Event[];
    },
  });
  const refreshAll = () => {
    onChanged();
    qc.invalidateQueries({ queryKey: ["project-messages"] });
    qc.invalidateQueries({ queryKey: ["project-checkpoints"] });
    qc.invalidateQueries({ queryKey: ["project-events"] });
  };

  // ---- Overzicht / projectplan ----
  const [plan, setPlan] = useState({ description: "", project_plan: "", status: "actief" as ProjectStatus, owner_id: "", due_date: "", est: "", res: "", rec: "" });
  const [editing, setEditing] = useState(false);
  const loadPlan = (p: WsProject) => {
    const s = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
    setPlan({ description: presentText(p.description, { autoImport: p.created_origin === "bronimport" }), project_plan: presentText(p.project_plan), status: p.status, owner_id: p.owner_id ?? "",
      due_date: p.due_date ?? "", est: s(p.budget_estimate), res: s(p.budget_reserved), rec: s(p.budget_received) });
  };
  // Alleen buiten bewerkmodus synchroniseren, zodat een refetch ingevoerde tekst niet overschrijft.
  useEffect(() => { if (!editing) loadPlan(project); }, [project, editing]);
  useEffect(() => { setEditing(false); }, [pid]);
  const startEdit = () => { loadPlan(project); setEditing(true); };
  const cancelEdit = () => { setEditing(false); refreshAll(); };
  const savePlan = useMutation({
    mutationFn: async () => {
      const est = parseAmount(plan.est), res = parseAmount(plan.res), rec = parseAmount(plan.rec);
      if ([est, res, rec].includes("invalid")) throw new Error("Bedrag ongeldig; laat leeg als het onbekend is");
      const { data, error } = await db.from("internal_projects").update({
        description: changedText(project.description, plan.description, { autoImport: project.created_origin === "bronimport" }), project_plan: changedText(project.project_plan, plan.project_plan), status: plan.status,
        owner_id: plan.owner_id || null, due_date: plan.due_date || null, budget_estimate: est, budget_reserved: res, budget_received: rec,
      }).eq("id", pid).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Geen toegang");
    },
    onSuccess: () => { toast.success("Project opgeslagen"); setEditing(false); refreshAll(); },
    onError: (e) => toast.error("Opslaan mislukt: " + errMsg(e)),
  });

  const [addPerson, setAddPerson] = useState("");
  const participantMut = useMutation({
    mutationFn: async ({ userId, remove }: { userId: string; remove?: boolean }) => {
      const q = remove
        ? db.from("internal_project_participants").delete().eq("project_id", pid).eq("user_id", userId).select("user_id")
        : db.from("internal_project_participants").insert({ project_id: pid, user_id: userId }).select("user_id");
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) throw new Error("Geen toegang");
    },
    onSuccess: () => { setAddPerson(""); qc.invalidateQueries({ queryKey: ["project-participants"] }); refreshAll(); },
    onError: (e) => toast.error("Deelnemer bijwerken mislukt: " + errMsg(e)),
  });

  // ---- Taken ----
  const claim = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.rpc("claim_internal_task", { _task_id: id });
      if (error) throw error;
      if (data !== true) throw new Error("Taak is al door iemand anders opgepakt of afgerond");
    },
    onSuccess: () => { toast.success("Taak opgepakt"); refreshAll(); },
    onError: (e) => { toast.error(errMsg(e)); refreshAll(); },
  });
  const complete = useMutation({
    mutationFn: (t: WsTask) => completeTaskLocally(db, t),
    onSuccess: () => { toast.success("Taak afgerond"); refreshAll(); qc.invalidateQueries({ queryKey: ["topical-links"] }); },
    onError: (e) => toast.error("Afronden mislukt: " + errMsg(e)),
  });

  // ---- Berichten / notities ----
  const postMessage = useMutation({
    mutationFn: async ({ row }: { row: Record<string, unknown>; done?: () => void }) => {
      const { data, error } = await db.from("internal_project_messages").insert({ project_id: pid, ...row }).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Geen toegang");
    },
    onSuccess: (_d, v) => { v.done?.(); toast.success("Geplaatst"); refreshAll(); },
    onError: (e) => toast.error("Plaatsen mislukt: " + errMsg(e)),
  });

  // ---- Controlepunten ----
  const cpMut = useMutation({
    mutationFn: async (a: CpAction) => {
      const t = db.from("internal_project_checkpoints");
      const q = a.op === "add" ? t.insert({ project_id: pid, position: (checkpointsQ.data?.length ?? 0) + 1, ...a.row }).select("id")
        : a.op === "update" ? t.update(a.row).eq("id", a.id).select("id") : t.delete().eq("id", a.id).select("id");
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) throw new Error("Geen toegang of controlepunt bestaat niet meer");
    },
    onSuccess: (_d, a) => { a.done?.(); qc.invalidateQueries({ queryKey: ["project-checkpoints"] }); qc.invalidateQueries({ queryKey: ["project-events"] }); },
    onError: (e) => toast.error("Controlepunt opslaan mislukt: " + errMsg(e)),
  });

  const messages = messagesQ.data ?? [];
  const threads = messages.filter((m) => m.kind === "bericht");
  const notes = messages.filter((m) => m.kind === "notitie" || m.kind === "voortgang" || m.kind === "bronupdate");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Alle projecten</Button>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl uppercase break-words">{project.title}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5 items-center text-xs text-muted-foreground">
              <Badge variant="outline">{project.archived_at ? "Gearchiveerd" : PROJECT_STATUS_LABEL[project.status]}</Badge>
              <span>Verantwoordelijke: {byName(project.owner_id)}</span>
              {project.due_date && <span>· einddatum {project.due_date}</span>}
            </div>
          </div>
          <StaffAvatars ids={people} staff={staff} />
        </div>
        <ProgressBar open={prog.open} done={prog.done} pct={prog.pct} />
      </div>

      <Tabs defaultValue="overzicht">
        <div className="overflow-x-auto -mx-1 px-1"><TabsList>
          <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
          <TabsTrigger value="taken">Taken ({prog.open})</TabsTrigger>
          <TabsTrigger value="berichten">Berichten</TabsTrigger>
          <TabsTrigger value="notities">Notities</TabsTrigger>
          <TabsTrigger value="geschiedenis">Geschiedenis</TabsTrigger>
        </TabsList></div>

        <TabsContent value="overzicht" className="space-y-4">
          {!editing ? (
            <div className="space-y-4 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <div className="flex gap-1"><dt className="text-muted-foreground">Verantwoordelijke:</dt><dd>{project.owner_id ? byName(project.owner_id) : "Niet vastgesteld"}</dd></div>
                  <div className="flex gap-1"><dt className="text-muted-foreground">Einddatum:</dt><dd>{project.due_date ?? "Niet vastgesteld"}</dd></div>
                  {[project.budget_estimate, project.budget_reserved, project.budget_received].some((v) => v != null) && (
                    <div className="flex gap-1 tabular-nums"><dt className="text-muted-foreground">Budget:</dt><dd>{([["Raming", project.budget_estimate], ["Gereserveerd", project.budget_reserved], ["Ontvangen", project.budget_received]] as [string, number | null][]).filter(([, v]) => v != null).map(([l, v]) => `${l} ${eur(v)}`).join(" · ")}</dd></div>
                  )}
                </dl>
                <Button size="sm" variant="outline" onClick={startEdit}>Project bewerken</Button>
              </div>
              <section className="rounded-md border-l-4 border-primary bg-muted/40 p-3 space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In het kort</h3>
                <p className="whitespace-pre-wrap break-words">{presentText(project.description, { autoImport: project.created_origin === "bronimport" }) || "Nog geen stand vastgelegd."}</p>
              </section>
              <PlanView text={presentText(project.project_plan)} />
            </div>
          ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!savePlan.isPending) savePlan.mutate(); }}>
            <div><Label htmlFor="ws-desc">In het kort / omschrijving</Label><Textarea id="ws-desc" value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} /></div>
            <div><Label htmlFor="ws-plan">Projectplan</Label><Textarea id="ws-plan" rows={10} placeholder="Nog geen projectplan vastgelegd" value={plan.project_plan} onChange={(e) => setPlan({ ...plan, project_plan: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">Koppen op een eigen regel: Huidige stand, Verloop, Vervolg, Praktische opvolging. Onder Verloop: datum | titel | tekst. Lijsten met "- ".</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Status</Label>
                <Select value={plan.status} onValueChange={(v) => setPlan({ ...plan, status: v as ProjectStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Verantwoordelijke</Label>
                <Select value={plan.owner_id || NONE} onValueChange={(v) => setPlan({ ...plan, owner_id: v === NONE ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NONE}>Niemand</SelectItem>{staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{displayName(s)}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label htmlFor="ws-due">Einddatum</Label><Input id="ws-due" type="date" value={plan.due_date} onChange={(e) => setPlan({ ...plan, due_date: e.target.value })} /></div>
            </div>
            <details className="rounded-md border border-border p-3" open={!!(plan.est || plan.res || plan.rec)}>
              <summary className="cursor-pointer text-sm font-medium">Budget (optioneel; leeg = onbekend)</summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label htmlFor="ws-est">Raming</Label><Input id="ws-est" inputMode="decimal" className="tabular-nums" placeholder="Onbekend" value={plan.est} onChange={(e) => setPlan({ ...plan, est: e.target.value })} /></div>
                <div><Label htmlFor="ws-res">Gereserveerd</Label><Input id="ws-res" inputMode="decimal" className="tabular-nums" placeholder="Onbekend" value={plan.res} onChange={(e) => setPlan({ ...plan, res: e.target.value })} /></div>
                <div><Label htmlFor="ws-rec">Ontvangen</Label><Input id="ws-rec" inputMode="decimal" className="tabular-nums" placeholder="Onbekend" value={plan.rec} onChange={(e) => setPlan({ ...plan, rec: e.target.value })} /></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Registratie in het project; dit boekt niets in de administratie.</p>
            </details>
            <div className="flex gap-2">
              <Button type="submit" disabled={savePlan.isPending}>{savePlan.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Opslaan</Button>
              <Button type="button" variant="outline" disabled={savePlan.isPending} onClick={cancelEdit}>Annuleren</Button>
            </div>
          </form>
          )}


          <section className="space-y-2">
            <h3 className="font-medium">Deelnemers</h3>
            <p className="text-xs text-muted-foreground">Verantwoordelijke, uitvoerders van projecttaken en expliciet toegevoegde medewerkers.</p>
            <ul className="flex flex-wrap gap-2">
              {people.map((id) => {
                const isExplicit = explicit.some((e) => e.user_id === id);
                return (
                  <li key={id} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-sm">
                    {byName(id)}
                    {isExplicit && <button type="button" aria-label={`${byName(id)} verwijderen`} onClick={() => participantMut.mutate({ userId: id, remove: true })}><X className="h-3.5 w-3.5" /></button>}
                  </li>
                );
              })}
              {people.length === 0 && <li className="text-sm text-muted-foreground">Nog geen deelnemers.</li>}
            </ul>
            <div className="flex gap-2 max-w-md">
              <Select value={addPerson || NONE} onValueChange={(v) => setAddPerson(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Medewerker toevoegen" /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Medewerker kiezen…</SelectItem>{staff.filter((s) => !explicit.some((e) => e.user_id === s.user_id)).map((s) => <SelectItem key={s.user_id} value={s.user_id}>{displayName(s)}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" disabled={!addPerson || participantMut.isPending} onClick={() => participantMut.mutate({ userId: addPerson })}>Toevoegen</Button>
            </div>
          </section>

          <CheckpointTable rows={checkpointsQ.data} loading={checkpointsQ.isLoading} error={checkpointsQ.error} staff={staff} onMut={(a) => cpMut.mutate(a)} busy={cpMut.isPending} />
        </TabsContent>

        <TabsContent value="taken" className="space-y-3">
          <Button onClick={() => onEditTask({ status: "te_doen", priority: "normaal", project_id: pid })}><Plus className="h-4 w-4 mr-1" />Taak toevoegen</Button>
          {projTasks.length === 0 ? <Empty>Nog geen taken in dit project.</Empty> : (
            <ul className="space-y-2">
              {[...projTasks].sort((a, b) => Number(a.status === "afgerond") - Number(b.status === "afgerond")).map((t) => {
                const late = isOverdue(t, today);
                return (
                  <li key={t.id} className="rounded-lg border border-border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium break-words ${t.status === "afgerond" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground items-center">
                        <Badge variant="outline">{TASK_STATUS_LABEL[t.status]}</Badge>
                        <Badge variant={t.priority === "hoog" ? "destructive" : "secondary"}>{PRIORITY_LABEL[t.priority]}</Badge>
                        <span>{t.assignee_id ? byName(t.assignee_id) : "Niet toegewezen"}</span>
                        {t.deadline && <span className={late ? "text-destructive font-medium" : ""}>· {late ? "Verlopen " : "Deadline "}{t.deadline}</span>}
                        {t.status === "afgerond" && <span>· afgerond door {t.completed_by || t.local_only_completed_by ? byName(t.completed_by ?? t.local_only_completed_by ?? null) : NOT_RECORDED}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {canClaim(t) && <Button size="sm" variant="outline" disabled={claim.isPending} onClick={() => claim.mutate(t.id)}><Hand className="h-4 w-4 mr-1" />Oppakken</Button>}
                      {t.status !== "afgerond" && <Button size="sm" variant="outline" disabled={complete.isPending} onClick={() => complete.mutate(t)}><CheckCircle2 className="h-4 w-4 mr-1" />Afronden</Button>}
                      <Button size="sm" variant="ghost" onClick={() => onEditTask(t)}>Bewerken</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="berichten" className="space-y-3">
          <SimplePost label="Nieuw bericht" busy={postMessage.isPending} onPost={(body, done) => postMessage.mutate({ row: { kind: "bericht", body }, done })} />
          <MessageList q={messagesQ} items={threads} staff={staff} empty="Nog geen berichten." />
        </TabsContent>

        <TabsContent value="notities" className="space-y-4">
          <NotePost busy={postMessage.isPending} onPost={(row, done) => postMessage.mutate({ row, done })} />
          <MessageList q={messagesQ} items={notes} staff={staff} empty="Nog geen notities of voortgang." />
        </TabsContent>

        <TabsContent value="geschiedenis" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Project aangemaakt {fmtDate(project.created_at)}{project.created_origin === "bronimport" ? "" : ` door ${project.created_origin == null && !project.created_by ? NOT_RECORDED : creatorLabel(project, staff)}`}.
            Wijzigingen van vóór de invoering van deze geschiedenis zijn niet geregistreerd.
          </p>
          {eventsQ.isLoading ? <Loading /> : eventsQ.error ? <ErrorBox e={eventsQ.error} /> : (eventsQ.data ?? []).length === 0 ? <Empty>Nog geen geregistreerde wijzigingen.</Empty> : (
            <ol className="space-y-1.5">
              {eventsQ.data!.map((ev) => (
                <li key={ev.id} className="text-sm border-l-2 border-primary/40 pl-3">
                  <span className="break-words">{presentEventSummary(ev)}</span>
                  <span className="block text-xs text-muted-foreground">{fmtDate(ev.created_at)}{ev.actor_kind === "bronimport" ? "" : ` · ${actorLabel(ev.actor_kind, ev.actor_id, staff)}`}</span>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanView({ text }: { text: string }) {
  const sections = parsePlan(text);
  if (!sections.length) return <p className="text-sm text-muted-foreground">Nog geen projectplan vastgelegd.</p>;
  return (
    <div className="space-y-4 min-w-0">
      {sections.map((s, i) => (
        <section key={i} className="space-y-2 min-w-0">
          {s.heading && <h3 className="font-display uppercase text-base">{s.heading}</h3>}
          {s.blocks.map((b, j) => b.type === "paragraph" ? (
            <p key={j} className="whitespace-pre-wrap break-words text-sm">{b.text}</p>
          ) : b.type === "list" ? (
            b.ordered
              ? <ol key={j} className="list-decimal pl-5 space-y-1 text-sm">{b.items.map((it, k) => <li key={k} className="break-words">{it}</li>)}</ol>
              : <ul key={j} className="list-disc pl-5 space-y-1 text-sm">{b.items.map((it, k) => <li key={k} className="break-words">{it}</li>)}</ul>
          ) : (
            <ol key={j} className="relative border-l-2 border-border ml-1.5 space-y-4">
              {b.items.map((it, k) => (
                <li key={k} className="relative pl-4 min-w-0">
                  <span aria-hidden className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-primary" />
                  <p className="text-xs text-muted-foreground tabular-nums break-words">{it.date}</p>
                  {it.title && <p className="font-medium text-sm break-words">{it.title}</p>}
                  {it.text && <p className="text-sm whitespace-pre-wrap break-words">{it.text}</p>}
                </li>
              ))}
            </ol>
          ))}
        </section>
      ))}
    </div>
  );
}

export function ProgressBar({ open, done, pct }: { open: number; done: number; pct: number | null }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums"><span>Taakvoortgang · {open} open · {done} afgerond</span><span>{pct == null ? "Geen taken" : `${pct}% taken afgerond`}</span></div>
      <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-primary" style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
}

const Loading = () => <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Laden...</p>;
const Empty = ({ children }: { children: React.ReactNode }) => <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</div>;
const ErrorBox = ({ e }: { e: unknown }) => <p role="alert" className="text-sm text-destructive">Kon niet laden: {errMsg(e)}</p>;

type CpAction = { op: "add" | "update" | "delete"; id?: string; row?: Partial<Checkpoint>; done?: () => void };

/** Tekst blijft staan tot opslaan bevestigd is; tijdens verzenden geen tweede verzending. */
export function SimplePost({ label, busy, onPost }: { label: string; busy: boolean; onPost: (body: string, done: () => void) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (busy || !v.trim()) return; onPost(v.trim(), () => setV("")); }}>
      <Label htmlFor="ws-msg">{label}</Label>
      <Textarea id="ws-msg" value={v} maxLength={20000} onChange={(e) => setV(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy || !v.trim()}>Plaatsen</Button>
    </form>
  );
}

export function NotePost({ busy, onPost }: { busy: boolean; onPost: (row: Record<string, unknown>, done: () => void) => void }) {
  const [kind, setKind] = useState<"notitie" | "voortgang">("notitie");
  const [body, setBody] = useState("");
  const submit = () => {
    if (busy || !body.trim()) return;
    onPost({ kind, body: body.trim() }, () => setBody(""));
  };
  return (
    <form className="space-y-2 rounded-md border border-border p-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="w-full sm:w-56"><Label>Soort</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="notitie">Notitie</SelectItem><SelectItem value="voortgang">Voortgang</SelectItem></SelectContent>
        </Select></div>
      <div><Label htmlFor="ws-note">Tekst</Label><Textarea id="ws-note" value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <Button type="submit" size="sm" disabled={busy || !body.trim()}>Plaatsen</Button>
    </form>
  );
}

const KIND_LABEL: Record<MessageKind, string> = { bericht: "Bericht", notitie: "Notitie", voortgang: "Voortgang", bronupdate: "Stand van zaken" };
const sourceDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : null);
function MessageList({ q, items, staff, empty }: { q: { isLoading: boolean; error: unknown }; items: Message[]; staff: StaffMember[]; empty: string }) {
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox e={q.error} />;
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-2">
      {items.map((m) => (
        <li key={m.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant={m.kind === "bronupdate" ? "default" : "secondary"}>{KIND_LABEL[m.kind]}</Badge>
            {m.kind === "bronupdate" || m.author_kind === "bronimport"
              ? <span>{sourceDay(m.kind === "bronupdate" ? m.source_date ?? m.created_at : m.created_at)}</span>
              : <><span className="font-medium text-foreground">{actorLabel(m.author_kind, m.author_id, staff)}</span><span>· {fmtDate(m.created_at)}</span></>}
          </div>
          {m.kind === "bronupdate" && (
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-sm">
              <dt className="text-muted-foreground">Laatste actie</dt><dd className="whitespace-pre-wrap break-words">{presentText(m.last_action, { autoImport: true })}</dd>
              <dt className="text-muted-foreground">Volgende stap</dt><dd className="whitespace-pre-wrap break-words font-medium">{presentText(m.next_step, { autoImport: true })}</dd>
            </dl>
          )}
          {m.body && m.kind !== "bronupdate" && <p className="text-sm whitespace-pre-wrap break-words">{m.author_kind === "bronimport" ? presentText(m.body, { autoImport: true }) : m.body}</p>}
        </li>
      ))}
    </ul>
  );
}

export function CheckpointTable({ rows, loading, error, staff, onMut, busy }: {
  rows: Checkpoint[] | undefined; loading: boolean; error: unknown; staff: StaffMember[]; busy: boolean;
  onMut: (a: CpAction) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  return (
    <section className="space-y-2">
      <h3 className="font-medium">Controlepunten</h3>
      {loading ? <Loading /> : error ? <ErrorBox e={error} /> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
              <th className="text-left p-2 font-medium">Controlepunt</th><th className="text-left p-2 font-medium w-28">Status</th>
              <th className="text-left p-2 font-medium w-40">Wie</th><th className="text-left p-2 font-medium w-36">Datum</th>
              <th className="text-left p-2 font-medium">Opmerkingen</th>
            </tr></thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={`${r.id}-${r.updated_at}`} className="border-t border-border align-top">
                  <td className="p-1"><div className="flex items-center gap-1">
                    <Input className="h-8" aria-label="Controlepunt" defaultValue={r.title} onBlur={(e) => e.target.value.trim() && e.target.value !== r.title && onMut({ op: "update", id: r.id, row: { title: e.target.value.trim() } })} />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Controlepunt verwijderen: ${r.title}`} disabled={busy} onClick={() => confirm(`Controlepunt "${r.title}" verwijderen?`) && onMut({ op: "delete", id: r.id })}><Trash2 className="h-4 w-4" /></Button>
                  </div></td>
                  <td className="p-1">
                    <Select value={r.status} onValueChange={(v) => onMut({ op: "update", id: r.id, row: { status: v as CheckpointStatus } })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(CHECKPOINT_STATUS_LABEL) as CheckpointStatus[]).map((s) => <SelectItem key={s} value={s}>{CHECKPOINT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                    </Select></td>
                  <td className="p-1">
                    <Select value={r.owner_id ?? NONE} onValueChange={(v) => onMut({ op: "update", id: r.id, row: { owner_id: v === NONE ? null : v } })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value={NONE}>—</SelectItem>{staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{displayName(s)}</SelectItem>)}</SelectContent>
                    </Select></td>
                  <td className="p-1"><Input className="h-8" type="date" defaultValue={r.due_date ?? ""} onBlur={(e) => (e.target.value || null) !== r.due_date && onMut({ op: "update", id: r.id, row: { due_date: e.target.value || null } })} /></td>
                  <td className="p-1"><Textarea rows={1} className="min-h-8 py-1" aria-label="Opmerkingen" defaultValue={presentText(r.remarks)} onBlur={(e) => { const v = changedText(r.remarks, e.target.value); if (v !== undefined) onMut({ op: "update", id: r.id, row: { remarks: v } }); }} /></td>
                </tr>
              ))}
              {(rows ?? []).length === 0 && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nog geen controlepunten.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <form className="flex gap-2 max-w-md" onSubmit={(e) => { e.preventDefault(); if (!busy && newTitle.trim()) onMut({ op: "add", row: { title: newTitle.trim() }, done: () => setNewTitle("") }); }}>
        <Input placeholder="Nieuw controlepunt" value={newTitle} maxLength={300} onChange={(e) => setNewTitle(e.target.value)} />
        <Button type="submit" variant="outline" disabled={busy || !newTitle.trim()}><Plus className="h-4 w-4" /></Button>
      </form>
    </section>
  );
}
