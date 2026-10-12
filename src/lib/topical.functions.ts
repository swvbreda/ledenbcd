import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeMsg } from "@/lib/plannerSync";
import { PLANNER_TARGET_PLAN_ID } from "@/lib/planner.functions";
import { completeTopicalTask, completionBlocker, matchPlanner, matchTodo, normTitle, todoHasRef, type LocalSourceTask, type TopicalLink } from "@/lib/topicalLink";

type Ctx = { supabase: any; userId: string };
const GUID = z.string().regex(/^[0-9a-fA-F-]{36}$/);
const MSID = z.string().regex(/^[A-Za-z0-9_=-]{10,300}$/);

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Geen toegang: alleen beheerders.");
}

async function graph() {
  const g = await import("@/lib/plannerGraph.server");
  const cfg = g.readGraphConfig(process.env);
  if (!cfg) throw new Error("Microsoft-koppeling niet ingesteld (servergegevens ontbreken).");
  const { token, roles } = await g.getAppToken(cfg);
  const client = g.makeGraphClient(token);
  return { g, roles, client, canRead: roles.includes("Tasks.Read.All") || roles.includes("Tasks.ReadWrite.All"), canWrite: roles.includes("Tasks.ReadWrite.All") };
}
function needRead(canRead: boolean) {
  if (!canRead) throw new Error("Microsoft-recht Tasks.Read.All of Tasks.ReadWrite.All (applicatie, met beheerderstoestemming) ontbreekt; To Do en Planner kunnen niet gelezen worden.");
}

async function loadSourceTasks(sb: any): Promise<LocalSourceTask[]> {
  const { data, error } = await sb.from("internal_tasks").select("id,title,source_ref").eq("source_system", "topical");
  if (error) throw new Error(error.message);
  return data as LocalSourceTask[];
}
async function loadLinks(sb: any): Promise<TopicalLink[]> {
  const { data, error } = await sb.from("topical_task_links").select("*");
  if (error) throw new Error(error.message);
  return data as TopicalLink[];
}
async function loadSource(sb: any) {
  const { data, error } = await sb.from("topical_todo_source").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data as { entra_user_id: string; account_display: string | null; list_id: string; list_name: string | null } | null;
}

/** Status: rechten-namen, bevestigde bron en koppelaantallen. Geen tokens of geheimen. */
export const topicalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const [tasks, links, source] = await Promise.all([loadSourceTasks(ctx.supabase), loadLinks(ctx.supabase), loadSource(ctx.supabase)]);
    let roles: string[] = [], canRead = false, canWrite = false, error: string | null = null;
    try { ({ roles, canRead, canWrite } = await graph()); } catch (e) { error = safeMsg(e); }
    return {
      roles, canRead, canWrite, error, source,
      total: tasks.length,
      todoLinked: links.filter((l) => l.todo_task_id).length,
      plannerLinked: links.filter((l) => l.planner_task_id).length,
    };
  });

/** Zoekt Microsoft-account en zijn To Do-lijsten (alleen lezen). */
export const topicalLookupLists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { g, client, canRead } = await graph();
    const { json } = await client.req("GET", `/users/${encodeURIComponent(data.email)}?$select=id,displayName,mail`);
    needRead(canRead);
    const lists = await g.todoPort(client).listLists(json.id);
    return { entraId: String(json.id), display: String(json.displayName ?? json.mail ?? data.email), lists };
  });

/** Bevestigt expliciet het account + de lijst; lijst wordt opnieuw bij Microsoft gecontroleerd. */
export const topicalConfirmSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entraId: GUID, display: z.string().max(200), listId: MSID, confirm: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { g, client, canRead } = await graph();
    needRead(canRead);
    const list = (await g.todoPort(client).listLists(data.entraId)).find((l) => l.id === data.listId);
    if (!list) throw new Error("Deze lijst hoort niet bij het gekozen Microsoft-account.");
    const { error } = await ctx.supabase.from("topical_todo_source").upsert({
      id: true, entra_user_id: data.entraId.toLowerCase(), account_display: data.display, list_id: list.id, list_name: list.name,
      confirmed_by: ctx.userId, confirmed_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, listName: list.name };
  });

/**
 * Leest originele To Do-taken en bestaande Planner-taken (vast plan) en koppelt uitsluitend unieke bron-id-matches.
 * Maakt nooit externe taken aan en wijzigt niets bij Microsoft.
 */
export const topicalScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const source = await loadSource(ctx.supabase);
    if (!source) throw new Error("Bevestig eerst het Microsoft-account en de To Do-lijst.");
    const { g, client, canRead } = await graph();
    needRead(canRead);
    const [locals, links] = await Promise.all([loadSourceTasks(ctx.supabase), loadLinks(ctx.supabase)]);
    const linkOf = new Map(links.map((l) => [l.task_id, l]));

    const todos = await g.todoPort(client).listTasks(source.entra_user_id, source.list_id);
    const pp = g.plannerPort(client);
    const buckets = await pp.listBuckets(PLANNER_TARGET_PLAN_ID);
    const planner: { id: string; title: string; description: string | null; planId: string }[] = [];
    let detailsFailed = 0;
    for (const b of buckets) for (const t of await pp.listBucketTasks(b.id)) {
      if (t.detailsError) detailsFailed++;
      planner.push({ id: t.id, title: t.title, description: t.description, planId: PLANNER_TARGET_PLAN_ID });
    }

    const todoFor = locals.filter((l) => !linkOf.get(l.id)?.todo_task_id);
    const plannerFor = locals.filter((l) => !linkOf.get(l.id)?.planner_task_id);
    const todoC = matchTodo(todoFor, todos, new Set(links.map((l) => l.todo_task_id).filter(Boolean) as string[]));
    const planC = matchPlanner(plannerFor, planner, PLANNER_TARGET_PLAN_ID, new Set(links.map((l) => l.planner_task_id).filter(Boolean) as string[]));

    let autoTodo = 0, autoPlanner = 0;
    const save = async (taskId: string, patch: Record<string, unknown>) => {
      const local = locals.find((l) => l.id === taskId)!;
      const { error } = await ctx.supabase.from("topical_task_links").upsert({ task_id: taskId, source_ref: local.source_ref, ...patch, updated_at: new Date().toISOString() }, { onConflict: "task_id" });
      if (error) throw new Error(error.message);
    };
    for (const c of todoC) if (c.kind === "source_id") {
      await save(c.taskId, { todo_user_id: source.entra_user_id, todo_list_id: source.list_id, todo_task_id: c.todoId, todo_match: "source_id" }); autoTodo++;
    }
    for (const c of planC) if (c.kind === "source_id") {
      await save(c.taskId, { planner_plan_id: PLANNER_TARGET_PLAN_ID, planner_task_id: c.plannerId, planner_match: "source_id" }); autoPlanner++;
    }
    const title = (id: string) => todos.find((t) => t.id === id)?.title ?? id;
    return {
      todoTotal: todos.length, plannerTotal: planner.length, detailsFailed, autoTodo, autoPlanner,
      review: todoC.filter((c) => c.kind !== "source_id").map((c) => ({
        taskId: c.taskId, kind: c.kind, candidates: "todoIds" in c ? c.todoIds.map((id) => ({ id, title: title(id) })) : [],
      })),
      plannerMissing: planC.filter((c) => c.kind !== "source_id").map((c) => ({ taskId: c.taskId, kind: c.kind, count: c.plannerIds.length })),
    };
  });

/** Handmatige bevestiging van een titel-kandidaat; server controleert opnieuw lijst, titel en uniciteit. */
export const topicalConfirmTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid(), todoId: MSID, confirm: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const source = await loadSource(ctx.supabase);
    if (!source) throw new Error("Bevestig eerst het Microsoft-account en de To Do-lijst.");
    const { data: local, error } = await ctx.supabase.from("internal_tasks").select("id,title,source_ref").eq("id", data.taskId).eq("source_system", "topical").maybeSingle();
    if (error || !local) throw new Error("Topical-taak niet gevonden.");
    const { g, client, canRead } = await graph();
    needRead(canRead);
    const t = await g.todoPort(client).getTodo(source.entra_user_id, source.list_id, data.todoId);
    if (normTitle(t.title) !== normTitle(local.title) && !todoHasRef(t, local.source_ref)) throw new Error("Titel komt niet (meer) overeen; niet gekoppeld.");
    const { data: used } = await ctx.supabase.from("topical_task_links").select("task_id").eq("todo_task_id", data.todoId).neq("task_id", data.taskId).maybeSingle();
    if (used) throw new Error("Deze To Do-taak is al aan een andere Topical-actie gekoppeld.");
    const { error: e2 } = await ctx.supabase.from("topical_task_links").upsert({
      task_id: local.id, source_ref: local.source_ref, todo_user_id: source.entra_user_id, todo_list_id: source.list_id,
      todo_task_id: data.todoId, todo_match: "title_confirmed", confirmed_by: ctx.userId, updated_at: new Date().toISOString(),
    }, { onConflict: "task_id" });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** Afronden van een Topical-taak: To Do completed + Planner 100%, lokaal pas na beide bevestigd. */
export const topicalComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = ctx.supabase;
    const { data: task, error } = await sb.from("internal_tasks").select("id,status,source_system").eq("id", data.taskId).maybeSingle();
    if (error || !task) throw new Error("Taak niet gevonden of geen toegang.");
    if (task.source_system !== "topical") throw new Error("Geen Topical-taak; rond lokaal af.");
    const { data: link } = await sb.from("topical_task_links").select("*").eq("task_id", data.taskId).maybeSingle();
    const { g, client, canWrite } = await graph();
    const blocker = completionBlocker(link as TopicalLink | null, canWrite, PLANNER_TARGET_PLAN_ID);
    if (blocker) throw new Error(blocker);
    const todo = g.todoPort(client), pp = g.plannerPort(client);
    const now = new Date().toISOString();
    await sb.from("topical_task_links").update({ last_attempt_at: now }).eq("task_id", data.taskId);
    return completeTopicalTask(link as TopicalLink, {
      getTodo: (u, l, t) => todo.getTodo(u, l, t),
      completeTodo: (u, l, t, e) => todo.completeTodo(u, l, t, e),
      async getPlanner(id) {
        const { json } = await client.req("GET", `/planner/tasks/${id}?$select=id,planId,percentComplete`);
        const d = await pp.getDetails(id);
        return { etag: json["@odata.etag"], planId: json.planId, percentComplete: json.percentComplete ?? 0, description: d.description };
      },
      async completePlanner(id, etag) { await pp.patchTask(id, etag, { percentComplete: 100 }); },
    }, {
      async saveLink(p) {
        const { error: e } = await sb.from("topical_task_links").update({ ...p, updated_at: new Date().toISOString() }).eq("task_id", data.taskId);
        if (e) throw new Error(e.message);
      },
      async markLocalDone() {
        if (task.status === "afgerond") return;
        const { error: e } = await sb.from("internal_tasks").update({ status: "afgerond" }).eq("id", data.taskId);
        if (e) throw new Error(e.message);
      },
      now: () => new Date().toISOString(),
    }, PLANNER_TARGET_PLAN_ID);
  });
