import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LockLostError, resolveConflictPatch, resolveUncertainPatch, safeMsg, syncOutcome, syncProject, type DbPort, type LocalTask, type TaskLink } from "@/lib/plannerSync";

const GUID = z.string().regex(/^[0-9a-fA-F-]{36}$/);
const PLAN = z.string().regex(/^[A-Za-z0-9_-]{10,64}$/);
export const PLANNER_REQUIRED_ROLES = ["Tasks.ReadWrite.All"] as const;
/** Door de gebruiker gekozen doelplan "To do" (BCD-team, kanaal Algemeen). Geen ander plan toegestaan. */
export const PLANNER_TARGET_PLAN_ID = "ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6";
export function assertTargetPlan(planId: string) {
  if (planId !== PLANNER_TARGET_PLAN_ID) throw new Error("Alleen het gekozen plan 'To do' is toegestaan.");
}
const LOCK_MS = 3 * 60_000;
const MAX_SYNC_MS = 10 * 60_000;

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Geen toegang: alleen beheerders.");
}

async function graphSetup() {
  const g = await import("@/lib/plannerGraph.server");
  const cfg = g.readGraphConfig(process.env);
  if (!cfg) throw new Error("Microsoft-koppeling niet ingesteld (servergegevens ontbreken).");
  const { token, roles } = await g.getAppToken(cfg);
  return { g, cfg, roles, client: g.makeGraphClient(token) };
}

/** Status: alleen namen van rechten en of Planner-toegang werkt; nooit tokens of ids van de app. */
export const plannerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const g = await import("@/lib/plannerGraph.server");
    const cfg = g.readGraphConfig(process.env);
    if (!cfg) return { configured: false, roles: [] as string[], canRead: false, canWrite: false, canListGroups: false, error: null as string | null };
    try {
      const { roles } = await g.getAppToken(cfg);
      return {
        configured: true, roles,
        canRead: roles.includes("Tasks.Read.All") || roles.includes("Tasks.ReadWrite.All"),
        canWrite: roles.includes("Tasks.ReadWrite.All"),
        canListGroups: roles.includes("Group.Read.All") || roles.includes("Group.ReadWrite.All") || roles.includes("GroupMember.Read.All"),
        error: null,
      };
    } catch (e) {
      return { configured: true, roles: [], canRead: false, canWrite: false, canListGroups: false, error: safeMsg(e) };
    }
  });

/** Lijst Microsoft 365-groepen/teams (alleen als Group.Read.All aanwezig is). */
export const plannerListGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { client } = await graphSetup();
    const rows = await client.list<{ id: string; displayName: string }>(
      "/groups?$filter=groupTypes/any(c:c eq 'Unified')&$select=id,displayName&$top=100", 10);
    return rows.map((r) => ({ id: r.id, name: r.displayName }));
  });

/** Bestaande plannen van een gekozen groep/team (alleen lezen). */
export const plannerListPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ groupId: GUID }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { client } = await graphSetup();
    const rows = await client.list<{ id: string; title: string }>(`/groups/${data.groupId}/planner/plans?$select=id,title`, 10);
    return rows.map((r) => ({ id: r.id, title: r.title, allowed: r.id === PLANNER_TARGET_PLAN_ID }));
  });

/** Metadata + buckets van het vastgestelde doelplan (alleen lezen). */
export const plannerTargetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { g, client } = await graphSetup();
    const port = g.plannerPort(client);
    try {
      const plan = await port.getPlan(PLANNER_TARGET_PLAN_ID);
      const buckets = await port.listBuckets(PLANNER_TARGET_PLAN_ID);
      return { ok: true as const, planId: plan.id, title: plan.title, hasGroup: !!plan.groupId, buckets };
    } catch (e) {
      return { ok: false as const, planId: PLANNER_TARGET_PLAN_ID, error: safeMsg(e) };
    }
  });

/** Maakt één bucket in het doelplan; alleen na expliciete klik van de beheerder. */
export const plannerCreateBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(200), confirm: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { g, client } = await graphSetup();
    const port = g.plannerPort(client);
    const existing = await port.listBuckets(PLANNER_TARGET_PLAN_ID);
    if (existing.some((b) => b.name.trim().toLowerCase() === data.name.toLowerCase())) throw new Error("Er bestaat al een bucket met deze naam; koppel die.");
    return port.createBucket(PLANNER_TARGET_PLAN_ID, data.name);
  });

/** Koppelt een project expliciet aan een bestaande bucket in het doelplan; één project per bucket. */
export const plannerLinkProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid(), planId: PLAN, bucketId: PLAN }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    assertTargetPlan(data.planId);
    const { g, client } = await graphSetup();
    const port = g.plannerPort(client);
    const plan = await port.getPlan(data.planId);
    if (!plan.groupId) throw new Error("Plan hoort niet bij een Microsoft 365-groep/team.");
    const bucket = (await port.listBuckets(data.planId)).find((b) => b.id === data.bucketId);
    if (!bucket) throw new Error("Deze bucket hoort niet bij het gekozen plan.");
    const { data: taken, error: e1 } = await ctx.supabase.from("planner_project_links").select("project_id")
      .eq("plan_id", data.planId).eq("bucket_id", data.bucketId).neq("project_id", data.projectId).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (taken) throw new Error("Deze bucket is al aan een ander project gekoppeld.");
    const { data: cur } = await ctx.supabase.from("planner_project_links").select("plan_id,bucket_id").eq("project_id", data.projectId).maybeSingle();
    if (cur && (cur.plan_id !== data.planId || (cur.bucket_id && cur.bucket_id !== data.bucketId))) {
      const { count } = await ctx.supabase.from("planner_task_links").select("task_id", { count: "exact", head: true }).eq("plan_id", cur.plan_id).not("planner_task_id", "is", null)
        .in("task_id", ((await ctx.supabase.from("internal_tasks").select("id").eq("project_id", data.projectId)).data ?? []).map((r: any) => r.id));
      if (count) throw new Error("Project heeft al gekoppelde Planner-taken in een andere bucket; omhangen is niet toegestaan.");
    }
    const { error } = await ctx.supabase.from("planner_project_links").upsert({
      project_id: data.projectId, group_id: plan.groupId, plan_id: data.planId, plan_title: plan.title, bucket_id: bucket.id, bucket_name: bucket.name, linked_by: ctx.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, planTitle: plan.title ?? "plan", bucketName: bucket.name };
  });

/** Zoekt het Microsoft-account bij het e-mailadres van een beheerder; niets wordt opgeslagen. */
export const plannerLookupUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { client } = await graphSetup();
    try {
      const { json } = await client.req("GET", `/users/${encodeURIComponent(data.email)}?$select=id,displayName,mail,userPrincipalName`);
      return { found: true as const, entraId: json.id as string, displayName: (json.displayName ?? json.mail ?? data.email) as string };
    } catch (e) {
      return { found: false as const, error: safeMsg(e) };
    }
  });

/** Bevestigt koppeling BCD-beheerder ↔ Microsoft-account (BCD-id is geen Entra-id). */
export const plannerConfirmUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), entraId: GUID, displayName: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { error } = await ctx.supabase.from("planner_user_map").upsert({
      user_id: data.userId, entra_id: data.entraId.toLowerCase(), entra_display: data.displayName, confirmed_by: ctx.userId, confirmed_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Conflict oplossen door expliciete keuze van de beheerder. */
export const plannerResolveConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid(), keep: z.enum(["local", "planner"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { data: link, error } = await ctx.supabase.from("planner_task_links").select("*").eq("task_id", data.taskId).maybeSingle();
    if (error || !link) throw new Error("Koppeling niet gevonden");
    if (link.state !== "conflict" || !link.planner_task_id) throw new Error("Er is geen op te lossen conflict.");
    const { error: e2 } = await ctx.supabase.from("planner_task_links").update({ ...resolveConflictPatch(link, data.keep), updated_at: new Date().toISOString() }).eq("task_id", data.taskId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** Beheerderbesluit bij onzekere aanmaak (na eigen controle in Planner). */
export const plannerResolveUncertain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid(), action: z.literal("retry_create") }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { data: link, error } = await ctx.supabase.from("planner_task_links").select("state,planner_task_id").eq("task_id", data.taskId).maybeSingle();
    if (error || !link) throw new Error("Koppeling niet gevonden");
    if (link.planner_task_id || (link.state !== "uncertain" && link.state !== "creating")) throw new Error("Taak is niet onzeker aangemaakt.");
    const { error: e2 } = await ctx.supabase.from("planner_task_links").update({ ...resolveUncertainPatch(data.action), updated_at: new Date().toISOString() })
      .eq("task_id", data.taskId).is("planner_task_id", null);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** Synchroniseert één gekoppeld project (projectslot met token, verlenging en maximale duur). */
export const plannerSyncProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = ctx.supabase;
    const { data: proj, error: pErr } = await sb.from("internal_projects").select("archived_at").eq("id", data.projectId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!proj) throw new Error("Project niet gevonden.");
    if (proj.archived_at) throw new Error("Gearchiveerd project wordt niet gesynchroniseerd.");
    const started = Date.now();
    const lockToken = crypto.randomUUID();
    const nowIso = new Date(started).toISOString();
    const { data: locked, error: lockErr } = await sb.from("planner_project_links")
      .update({ lock_until: new Date(started + LOCK_MS).toISOString(), lock_token: lockToken, last_sync_at: nowIso })
      .eq("project_id", data.projectId)
      .or(`lock_until.is.null,lock_until.lt.${nowIso}`)
      .select("plan_id,bucket_id").maybeSingle();
    if (lockErr) throw new Error(lockErr.message);
    if (!locked) throw new Error("Project is niet aan Planner gekoppeld of er loopt al een synchronisatie.");
    const release = () => sb.from("planner_project_links").update({ lock_until: null, lock_token: null }).eq("project_id", data.projectId).eq("lock_token", lockToken);
    if (!locked.bucket_id) { await release(); throw new Error("Kies eerst een Planner-bucket voor dit project."); }
    try { assertTargetPlan(locked.plan_id); } catch (e) { await release(); throw e; }

    const { data: log } = await sb.from("planner_sync_log").insert({ project_id: data.projectId, actor: ctx.userId }).select("id").single();
    const finish = async (patch: Record<string, unknown>, linkPatch: Record<string, unknown>) => {
      if (log) await sb.from("planner_sync_log").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", log.id);
      await sb.from("planner_project_links").update({ ...linkPatch, lock_until: null, lock_token: null }).eq("project_id", data.projectId).eq("lock_token", lockToken);
    };
    let lastBeat = started;
    const heartbeat = async () => {
      const now = Date.now();
      if (now - started > MAX_SYNC_MS) throw new LockLostError("Maximale synchronisatieduur bereikt; gestopt zonder verdere wijzigingen.");
      if (now - lastBeat < 30_000) return;
      const { data: ok, error } = await sb.from("planner_project_links").update({ lock_until: new Date(now + LOCK_MS).toISOString() })
        .eq("project_id", data.projectId).eq("lock_token", lockToken).select("project_id").maybeSingle();
      if (error || !ok) throw new LockLostError("Projectslot verloren; gestopt zonder verdere wijzigingen.");
      lastBeat = now;
    };
    try {
      const { g, cfg, client } = await graphSetup();
      const db: DbPort = {
        async tasks(pid) {
          const { data: rows, error } = await sb.from("internal_tasks").select("id,title,description,deadline,priority,status,assignee_id").eq("project_id", pid);
          if (error) throw new Error(error.message);
          return rows as LocalTask[];
        },
        async links(ids) {
          if (!ids.length) return [];
          const { data: rows, error } = await sb.from("planner_task_links").select("*").in("task_id", ids);
          if (error) throw new Error(error.message);
          return rows as TaskLink[];
        },
        async linkedPlannerIds() {
          const { data: rows, error } = await sb.from("planner_task_links").select("planner_task_id").eq("plan_id", locked.plan_id).not("planner_task_id", "is", null);
          if (error) throw new Error(error.message);
          return new Set((rows ?? []).map((r: any) => r.planner_task_id as string));
        },
        async userMap() {
          const { data: rows, error } = await sb.from("planner_user_map").select("user_id,entra_id");
          if (error) throw new Error(error.message);
          return rows;
        },
        async saveLink(l) {
          const row = { plan_id: locked.plan_id, ...l, updated_at: new Date().toISOString() };
          const { error } = await sb.from("planner_task_links").upsert(row, { onConflict: "task_id" });
          if (error) throw new Error(error.message);
        },
        async updateTask(id, patch) {
          const { error } = await sb.from("internal_tasks").update(patch).eq("id", id);
          if (error) throw new Error(error.message);
        },
        async insertTask(pid, t) {
          const { data: row, error } = await sb.from("internal_tasks").insert({ ...t, project_id: pid, created_by: ctx.userId }).select("id").single();
          if (error) throw new Error(error.message);
          return row.id as string;
        },
        heartbeat,
        newToken: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
      };
      const r = await syncProject({ projectId: data.projectId, planId: locked.plan_id, bucketId: locked.bucket_id, appId: cfg.clientId, graph: g.plannerPort(client), db });
      const outcome = syncOutcome(r);
      await finish(
        { ok: outcome === "success", outcome, warnings: r.warnings.length, created_remote: r.created, updated_remote: r.updatedRemote, updated_local: r.updatedLocal, conflicts: r.conflicts, error: r.warnings.length ? r.warnings.join("\n").slice(0, 2000) : null },
        outcome === "success" ? { last_success_at: new Date().toISOString(), last_error: null, last_outcome: outcome }
          : { last_outcome: outcome, last_error: `${r.conflicts} conflict(en), ${r.warnings.length} waarschuwing(en)` },
      );
      return { ...r, outcome };
    } catch (e) {
      const msg = safeMsg(e);
      await finish({ ok: false, outcome: "failed", error: msg }, { last_error: msg, last_outcome: "failed" });
      throw new Error(msg);
    }
  });
