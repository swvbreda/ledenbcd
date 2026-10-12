import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, Archive, CheckCircle2, ExternalLink, Loader2, Pencil, Plus } from "lucide-react";
import PlannerPanel from "@/components/projecten/PlannerPanel";
import TopicalPanel from "@/components/projecten/TopicalPanel";
import { useServerFn } from "@tanstack/react-start";
import { topicalComplete } from "@/lib/topical.functions";
import { completionSummary, localOnlyBadge } from "@/lib/topicalLink";
import {
  filterTasks,
  isOverdue,
  isValidTeamsUrl,
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
  TASK_STATUS_LABEL,
  type ProjectStatus,
  type TaskFilter,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/internalWork";

type Project = {
  id: string; title: string; description: string | null; owner_id: string | null; due_date: string | null;
  status: ProjectStatus; teams_url: string | null; archived_at: string | null;
};
type Task = {
  id: string; title: string; description: string | null; project_id: string | null; assignee_id: string | null;
  deadline: string | null; priority: TaskPriority; status: TaskStatus; source_system?: string | null; source_ref?: string | null;
};
type Staff = { user_id: string; email: string };

const db = supabase as any;
const todayStr = () => new Date().toISOString().slice(0, 10);
const NONE = "__none";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as any)?.message ?? "Onbekende fout");

export default function ProjectenPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Laden...</p>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <ProjectenInner />;
}

function ProjectenInner() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const qc = useQueryClient();
  const projectsQ = useQuery({
    queryKey: ["internal-projects", uid],
    queryFn: async () => {
      const { data, error } = await db.from("internal_projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });
  const tasksQ = useQuery({
    queryKey: ["internal-tasks", uid],
    queryFn: async () => {
      const { data, error } = await db.from("internal_tasks").select("*").order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Task[];
    },
  });
  const staffQ = useQuery({
    queryKey: ["internal-staff", uid],
    queryFn: async () => {
      const { data, error } = await db.rpc("list_internal_staff");
      if (error) throw error;
      return data as Staff[];
    },
  });
  const staffName = (id: string | null) => (id ? staffQ.data?.find((s) => s.user_id === id)?.email ?? "Onbekend account" : "—");

  const [filter, setFilter] = useState<TaskFilter>({ projectId: "all", status: "open", mine: false, overdue: false });
  const [showArchived, setShowArchived] = useState(false);
  const [editTask, setEditTask] = useState<Partial<Task> | null>(null);
  const [editProject, setEditProject] = useState<Partial<Project> | null>(null);
  const today = todayStr();

  const activeProjects = (projectsQ.data ?? []).filter((p) => !p.archived_at);
  const visibleProjects = (projectsQ.data ?? []).filter((p) => showArchived || !p.archived_at);
  const tasks = useMemo(() => filterTasks(tasksQ.data ?? [], filter, uid, today), [tasksQ.data, filter, uid, today]);
  const projectTitle = (id: string | null) => (id ? projectsQ.data?.find((p) => p.id === id)?.title ?? "—" : "Geen project");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["internal-projects"] });
    qc.invalidateQueries({ queryKey: ["internal-tasks"] });
  };

  const saveTask = useMutation({
    mutationFn: async (t: Partial<Task>) => {
      const row = {
        title: (t.title ?? "").trim(), description: t.description?.trim() || null, project_id: t.project_id || null,
        assignee_id: t.assignee_id || null, deadline: t.deadline || null, priority: t.priority ?? "normaal", status: t.status ?? "te_doen",
      };
      if (!row.title) throw new Error("Titel is verplicht");
      const q = t.id ? db.from("internal_tasks").update(row).eq("id", t.id).select("id") : db.from("internal_tasks").insert(row).select("id");
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) throw new Error("Niet opgeslagen: geen toegang of taak bestaat niet meer");
    },
    onSuccess: () => { toast.success("Taak opgeslagen"); setEditTask(null); invalidate(); },
    onError: (e) => toast.error("Opslaan mislukt: " + errMsg(e)),
  });
  const topicalFn = useServerFn(topicalComplete);
  const [topicalMsg, setTopicalMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const completeTopical = useMutation({
    mutationFn: (id: string) => topicalFn({ data: { taskId: id } }),
    onSuccess: (r, id) => { const s = completionSummary(r); setTopicalMsg((m) => ({ ...m, [id]: s })); s.ok ? toast.success("Topical-actie afgerond") : toast.error("Niet volledig afgerond"); invalidate(); },
    onError: (e, id) => setTopicalMsg((m) => ({ ...m, [id]: { ok: false, text: "Niet afgerond, taak blijft lokaal open: " + errMsg(e) } })),
  });
  const linksQ = useQuery({
    queryKey: ["topical-links", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await db.from("topical_task_links").select("task_id,todo_completed_at,planner_completed_at");
      if (error) throw error;
      return data as { task_id: string; todo_completed_at: string | null; planner_completed_at: string | null }[];
    },
  });
  const [choiceFor, setChoiceFor] = useState<Task | null>(null);
  const completeLocalOnly = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("topical_complete_local_only", { _task_id: id });
      if (error) throw error;
    },
    onSuccess: (_r, id) => { setChoiceFor(null); setTopicalMsg((m) => { const n = { ...m }; delete n[id]; return n; }); toast.success("Taak afgerond"); invalidate(); qc.invalidateQueries({ queryKey: ["topical-links"] }); },
    onError: (e) => toast.error("Afronden mislukt: " + errMsg(e)),
  });
  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.from("internal_tasks").update({ status: "afgerond" }).eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Geen toegang");
    },
    onSuccess: () => { toast.success("Taak afgerond"); invalidate(); },
    onError: (e) => toast.error("Afronden mislukt: " + errMsg(e)),
  });
  const saveProject = useMutation({
    mutationFn: async (p: Partial<Project>) => {
      const teams = p.teams_url?.trim() || null;
      if (teams && !isValidTeamsUrl(teams)) throw new Error("Teams-link moet een geldige https-link naar Teams/Microsoft zijn");
      const row = {
        title: (p.title ?? "").trim(), description: p.description?.trim() || null, owner_id: p.owner_id || null,
        due_date: p.due_date || null, status: p.status ?? "actief", teams_url: teams,
      };
      if (!row.title) throw new Error("Titel is verplicht");
      const q = p.id ? db.from("internal_projects").update(row).eq("id", p.id).select("id") : db.from("internal_projects").insert(row).select("id");
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) throw new Error("Niet opgeslagen: geen toegang");
    },
    onSuccess: () => { toast.success("Project opgeslagen"); setEditProject(null); invalidate(); },
    onError: (e) => toast.error("Opslaan mislukt: " + errMsg(e)),
  });
  const archiveProject = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { data, error } = await db.from("internal_projects").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Geen toegang");
    },
    onSuccess: (_d, v) => { toast.success(v.archive ? "Project gearchiveerd" : "Project teruggezet"); invalidate(); },
    onError: (e) => toast.error("Archiveren mislukt: " + errMsg(e)),
  });

  const loadError = projectsQ.error || tasksQ.error || staffQ.error;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <BcdHeroBanner title="Projecten & taken" subtitle="Intern werkoverzicht — alleen zichtbaar voor beheerders" />

      {loadError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Gegevens konden niet worden geladen: {errMsg(loadError)}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => { projectsQ.refetch(); tasksQ.refetch(); staffQ.refetch(); }}>Opnieuw</Button>
        </div>
      )}

      <Tabs defaultValue="taken">
        <TabsList>
          <TabsTrigger value="taken">Taken</TabsTrigger>
          <TabsTrigger value="projecten">Projecten</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="topical">Topical</TabsTrigger>
        </TabsList>

        <TabsContent value="taken" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-52">
              <Label className="text-xs">Project</Label>
              <Select value={filter.projectId} onValueChange={(v) => setFilter({ ...filter, projectId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle projecten</SelectItem>
                  <SelectItem value="none">Zonder project</SelectItem>
                  {activeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Label className="text-xs">Status</Label>
              <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v as TaskFilter["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Alle open</SelectItem>
                  <SelectItem value="all">Alles</SelectItem>
                  {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={filter.mine} onCheckedChange={(v) => setFilter({ ...filter, mine: v })} />Mijn taken</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={filter.overdue} onCheckedChange={(v) => setFilter({ ...filter, overdue: v })} />Verlopen</label>
            <Button className="sm:ml-auto" onClick={() => setEditTask({ status: "te_doen", priority: "normaal", project_id: filter.projectId !== "all" && filter.projectId !== "none" ? filter.projectId : null })}>
              <Plus className="h-4 w-4 mr-1" />Nieuwe taak
            </Button>
          </div>

          {tasksQ.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Taken laden...</p>
          ) : tasksQ.error ? null : tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {(tasksQ.data?.length ?? 0) === 0 ? "Nog geen taken. Maak de eerste taak aan." : "Geen taken voor deze filters."}
            </div>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => {
                const late = isOverdue(t, today);
                return (
                  <li key={t.id} className="rounded-lg border border-border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium break-words ${t.status === "afgerond" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground items-center">
                        <Badge variant="outline">{TASK_STATUS_LABEL[t.status]}</Badge>
                        <Badge variant={t.priority === "hoog" ? "destructive" : "secondary"}>{PRIORITY_LABEL[t.priority]}</Badge>
                        <span>{projectTitle(t.project_id)}</span>
                        <span>· {staffName(t.assignee_id)}</span>
                        {t.deadline && <span className={late ? "text-destructive font-medium" : ""}>· {late ? "Verlopen " : "Deadline "}{t.deadline}</span>}
                        {t.source_system === "topical" && <Badge variant="secondary">Topical {t.source_ref}</Badge>}
                      </div>
                      {topicalMsg[t.id] && <p role="status" className={`mt-1 text-xs ${topicalMsg[t.id].ok ? "text-muted-foreground" : "text-destructive"}`}>{topicalMsg[t.id].text}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {t.status !== "afgerond" && (
                        <Button size="sm" variant="outline" disabled={completeTask.isPending || completeTopical.isPending} onClick={() => (t.source_system === "topical" ? setChoiceFor(t) : completeTask.mutate(t.id))}>
                          {completeTopical.isPending && completeTopical.variables === t.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}{t.source_system === "topical" && topicalMsg[t.id] && !topicalMsg[t.id].ok ? "Opnieuw proberen" : "Afronden"}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" aria-label="Taak bewerken" onClick={() => setEditTask(t)}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="projecten" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} />Toon gearchiveerd</label>
            <Button className="ml-auto" onClick={() => setEditProject({ status: "actief" })}><Plus className="h-4 w-4 mr-1" />Nieuw project</Button>
          </div>
          {projectsQ.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Projecten laden...</p>
          ) : projectsQ.error ? null : visibleProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nog geen projecten.</div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {visibleProjects.map((p) => {
                const open = (tasksQ.data ?? []).filter((t) => t.project_id === p.id && t.status !== "afgerond").length;
                return (
                  <li key={p.id} className={`rounded-lg border border-border bg-card p-4 space-y-2 ${p.archived_at ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-2">
                      <p className="font-medium flex-1 break-words">{p.title}</p>
                      <Badge variant="outline">{p.archived_at ? "Gearchiveerd" : PROJECT_STATUS_LABEL[p.status]}</Badge>
                    </div>
                    {p.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{p.description}</p>}
                    <p className="text-xs text-muted-foreground">{staffName(p.owner_id)}{p.due_date ? ` · einddatum ${p.due_date}` : ""} · {open} open taken</p>
                    <div className="flex flex-wrap gap-2">
                      {p.teams_url && isValidTeamsUrl(p.teams_url) && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={p.teams_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Open in Teams</a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditProject(p)}><Pencil className="h-4 w-4 mr-1" />Bewerken</Button>
                      <Button size="sm" variant="ghost" disabled={archiveProject.isPending} onClick={() => archiveProject.mutate({ id: p.id, archive: !p.archived_at })}>
                        <Archive className="h-4 w-4 mr-1" />{p.archived_at ? "Terugzetten" : "Archiveren"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="planner" className="space-y-4">
          <PlannerPanel
            projects={activeProjects.map((p) => ({ id: p.id, title: p.title }))}
            staff={staffQ.data ?? []}
            tasks={(tasksQ.data ?? []).map((t) => ({ id: t.id, title: t.title, project_id: t.project_id }))}
            onSynced={invalidate}
          />
        </TabsContent>

        <TabsContent value="topical" className="space-y-4">
          <TopicalPanel tasks={(tasksQ.data ?? []).filter((t) => t.source_system === "topical").map((t) => ({ id: t.id, title: t.title, status: t.status }))} onChanged={invalidate} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!choiceFor} onOpenChange={(o) => !o && setChoiceFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Topical-actie afronden</DialogTitle></DialogHeader>
          <p className="text-sm break-words">{choiceFor?.title}</p>
          <div className="space-y-3">
            <div className="rounded border border-border p-3 space-y-2">
              <Button className="w-full" disabled={completeTopical.isPending || completeLocalOnly.isPending} onClick={() => { const id = choiceFor!.id; setChoiceFor(null); completeTopical.mutate(id); }}>Overal afronden</Button>
              <p className="text-xs text-muted-foreground">Zet de To Do-taak op voltooid en de Planner-taak op 100%. Lokaal pas afgerond als beide bevestigd zijn; vereist de Microsoft-koppeling.</p>
            </div>
            <div className="rounded border border-border p-3 space-y-2">
              <Button variant="outline" className="w-full" disabled={completeTopical.isPending || completeLocalOnly.isPending} onClick={() => completeLocalOnly.mutate(choiceFor!.id)}>
                {completeLocalOnly.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Alleen in het ledenbestand afronden
              </Button>
              <p className="text-xs text-muted-foreground">Teams en Topical worden hiermee niet bijgewerkt. Uw account en het tijdstip worden vastgelegd; overal afronden kan later nog.</p>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setChoiceFor(null)}>Annuleren</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTask?.id ? "Taak bewerken" : "Nieuwe taak"}</DialogTitle></DialogHeader>
          {editTask && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveTask.mutate(editTask); }}>
              <div><Label htmlFor="t-title">Titel</Label><Input id="t-title" required maxLength={200} value={editTask.title ?? ""} onChange={(e) => setEditTask({ ...editTask, title: e.target.value })} /></div>
              <div><Label htmlFor="t-desc">Omschrijving</Label><Textarea id="t-desc" value={editTask.description ?? ""} onChange={(e) => setEditTask({ ...editTask, description: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Project</Label>
                  <Select value={editTask.project_id ?? NONE} onValueChange={(v) => setEditTask({ ...editTask, project_id: v === NONE ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Geen project</SelectItem>{activeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>Verantwoordelijke</Label>
                  <Select value={editTask.assignee_id ?? NONE} onValueChange={(v) => setEditTask({ ...editTask, assignee_id: v === NONE ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Niemand</SelectItem>{(staffQ.data ?? []).map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.email}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label htmlFor="t-dl">Deadline</Label><Input id="t-dl" type="date" value={editTask.deadline ?? ""} onChange={(e) => setEditTask({ ...editTask, deadline: e.target.value || null })} /></div>
                <div><Label>Prioriteit</Label>
                  <Select value={editTask.priority ?? "normaal"} onValueChange={(v) => setEditTask({ ...editTask, priority: v as TaskPriority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((s) => <SelectItem key={s} value={s}>{PRIORITY_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="sm:col-span-2"><Label>Status</Label>
                  <Select value={editTask.status ?? "te_doen"} onValueChange={(v) => setEditTask({ ...editTask, status: v as TaskStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => <SelectItem key={s} value={s} disabled={s === "afgerond" && editTask.source_system === "topical" && (tasksQ.data ?? []).find((x) => x.id === editTask.id)?.status !== "afgerond"}>{TASK_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <DialogFooter><Button type="submit" disabled={saveTask.isPending}>{saveTask.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Opslaan</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProject} onOpenChange={(o) => !o && setEditProject(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editProject?.id ? "Project bewerken" : "Nieuw project"}</DialogTitle></DialogHeader>
          {editProject && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveProject.mutate(editProject); }}>
              <div><Label htmlFor="p-title">Titel</Label><Input id="p-title" required maxLength={200} value={editProject.title ?? ""} onChange={(e) => setEditProject({ ...editProject, title: e.target.value })} /></div>
              <div><Label htmlFor="p-desc">Omschrijving</Label><Textarea id="p-desc" value={editProject.description ?? ""} onChange={(e) => setEditProject({ ...editProject, description: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Verantwoordelijke</Label>
                  <Select value={editProject.owner_id ?? NONE} onValueChange={(v) => setEditProject({ ...editProject, owner_id: v === NONE ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Niemand</SelectItem>{(staffQ.data ?? []).map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.email}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label htmlFor="p-due">Einddatum</Label><Input id="p-due" type="date" value={editProject.due_date ?? ""} onChange={(e) => setEditProject({ ...editProject, due_date: e.target.value || null })} /></div>
                <div className="sm:col-span-2"><Label>Status</Label>
                  <Select value={editProject.status ?? "actief"} onValueChange={(v) => setEditProject({ ...editProject, status: v as ProjectStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div><Label htmlFor="p-teams">Teams-kanaallink (optioneel)</Label>
                <Input id="p-teams" type="url" placeholder="https://teams.microsoft.com/l/channel/..." value={editProject.teams_url ?? ""} onChange={(e) => setEditProject({ ...editProject, teams_url: e.target.value })} />
                {editProject.teams_url && !isValidTeamsUrl(editProject.teams_url) && <p className="text-xs text-destructive mt-1">Alleen https-links naar Teams/Microsoft zijn toegestaan.</p>}
                <p className="text-xs text-muted-foreground mt-1">Alleen een link; er worden geen berichten naar Teams gestuurd.</p>
              </div>
              <DialogFooter><Button type="submit" disabled={saveProject.isPending}>{saveProject.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Opslaan</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
