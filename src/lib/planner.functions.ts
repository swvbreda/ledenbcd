import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveConflictPatch, safeMsg, syncProject, type DbPort, type LocalTask, type TaskLink } from "@/lib/plannerSync";

const GUID = z.string().regex(/^[0-9a-fA-F-]{36}$/);
const PLAN = z.string().regex(/^[A-Za-z0-9_-]{10,64}$/);
export const PLANNER_REQUIRED_ROLES = ["Tasks.ReadWrite.All"] as const;

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
    return rows.map((r) => ({ id: r.id, title: r.title }));
  });

/** Koppelt een project expliciet aan een bestaand plan; controleert dat het plan bij de groep hoort. */
export const plannerLinkProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid(), groupId: GUID, planId: PLAN }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { client } = await graphSetup();
    const { json } = await client.req("GET", `/planner/plans/${data.planId}?$select=id,title,container,owner`);
    const container = (json.container?.containerId ?? json.owner ?? "").toLowerCase();
    if (container !== data.groupId.toLowerCase()) throw new Error("Dit plan hoort niet bij de gekozen groep/team.");
    const { error } = await ctx.supabase.from("planner_project_links").upsert({
      project_id: data.projectId, group_id: data.groupId, plan_id: data.planId, plan_title: json.title ?? null, linked_by: ctx.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, planTitle: json.title as string };
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

/** Synchroniseert één gekoppeld project (met projectslot tegen gelijktijdige runs). */
export const plannerSyncProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = ctx.supabase;
    const now = new Date();
    const { data: locked, error: lockErr } = await sb.from("planner_project_links")
      .update({ lock_until: new Date(now.getTime() + 3 * 60_000).toISOString(), last_sync_at: now.toISOString() })
      .eq("project_id", data.projectId)
      .or(`lock_until.is.null,lock_until.lt.${now.toISOString()}`)
      .select("plan_id").maybeSingle();
    if (lockErr) throw new Error(lockErr.message);
    if (!locked) throw new Error("Project is niet aan Planner gekoppeld of er loopt al een synchronisatie.");

    const { data: log } = await sb.from("planner_sync_log").insert({ project_id: data.projectId, actor: ctx.userId }).select("id").single();
    const finish = async (patch: Record<string, unknown>, linkPatch: Record<string, unknown>) => {
      if (log) await sb.from("planner_sync_log").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", log.id);
      await sb.from("planner_project_links").update({ ...linkPatch, lock_until: null }).eq("project_id", data.projectId);
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
        newToken: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
      };
      const r = await syncProject({ projectId: data.projectId, planId: locked.plan_id, appId: cfg.clientId, graph: g.plannerPort(client), db });
      await finish(
        { ok: true, created_remote: r.created, updated_remote: r.updatedRemote, updated_local: r.updatedLocal, conflicts: r.conflicts, error: r.warnings.length ? r.warnings.join("\n").slice(0, 2000) : null },
        { last_success_at: new Date().toISOString(), last_error: null },
      );
      return r;
    } catch (e) {
      const msg = safeMsg(e);
      await finish({ ok: false, error: msg }, { last_error: msg });
      throw new Error(msg);
    }
  });
