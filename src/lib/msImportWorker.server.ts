/** Gedeelde import-worker voor handmatige (admin) en geplande aanroep. Alleen lezen bij Microsoft. */
import { timingSafeEqual } from "node:crypto";
import { IMPORT_PLAN_ID, importOutcome, runImport, type ImportDb, type ImportGraph, type ImportResult } from "@/lib/msImport";

type Sb = any;

export function supabaseImportDb(sb: Sb, actor: string): ImportDb {
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as Record<string, number>;
  };
  return {
    async settings() {
      const { data, error } = await sb.from("ms_import_settings").select("agenda_user_id,agenda_calendar_id,planner_mode,planner_general_bucket_id").maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "Importinstellingen ontbreken");
      return data;
    },
    async linkedBuckets() {
      const { data, error } = await sb.from("planner_project_links").select("bucket_id,internal_projects!inner(archived_at)").eq("plan_id", IMPORT_PLAN_ID).not("bucket_id", "is", null).is("internal_projects.archived_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: { bucket_id: string }) => r.bucket_id);
    },
    applyAgenda: (calendarId, items, complete, fromDate, toDate) => rpc("ms_import_apply_agenda", { _actor: actor, _calendar: calendarId, _items: items, _complete: complete, _from: fromDate, _to: toDate }),
    applyPlanner: (bucketId, items, complete) => rpc("ms_import_apply_planner", { _actor: actor, _bucket: bucketId, _items: items, _complete: complete }),
  };
}

/** Eén run met logregel (alleen tellingen, geen inhoud). */
export async function runLogged(sb: Sb, actor: string, trigger: "manual" | "scheduled", graph: ImportGraph): Promise<ImportResult> {
  const { data: run } = await sb.from("ms_import_runs").insert({ trigger, actor }).select("id").single();
  try {
    const r = await runImport(graph, supabaseImportDb(sb, actor));
    const ok = importOutcome(r).ok; // onvolledig telt niet als geslaagd
    if (run) await sb.from("ms_import_runs").update({ finished_at: new Date().toISOString(), ok, summary: r }).eq("id", run.id);
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (run) await sb.from("ms_import_runs").update({ finished_at: new Date().toISOString(), ok: false, error: msg.slice(0, 500) }).eq("id", run.id);
    throw e;
  }
}

export async function liveImportGraph(env: Record<string, string | undefined>): Promise<ImportGraph> {
  const g = await import("@/lib/plannerGraph.server");
  const { importGraphPort, readOnlyGraph } = await import("@/lib/msImportGraph.server");
  const cfg = g.readGraphConfig(env);
  if (!cfg) throw new Error("Microsoft-koppeling niet ingesteld");
  const { token } = await g.getAppToken(cfg);
  return importGraphPort(readOnlyGraph(g.makeGraphClient(token, fetch, { deadlineAt: Date.now() + 8 * 60_000 })));
}

export interface ScheduledDeps { sb: Sb; graph: () => Promise<ImportGraph> }

/** Geplande aanroep: interne sleutel, schakelaar én releasegate, actor = laatste beheerder die instellingen wijzigde (actueel admin). */
export async function handleScheduledImport(request: Request, env: Record<string, string | undefined>, deps: () => Promise<ScheduledDeps>): Promise<Response> {
  const secret = env["INTERNAL_WEBHOOK_SECRET"]; const provided = request.headers.get("x-internal-secret");
  if (!secret || !provided || Buffer.byteLength(secret) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))) return new Response(null, { status: 401 });
  const { sb, graph } = await deps();
  const { data: s, error } = await sb.from("ms_import_settings").select("enabled,release_gate,updated_by").maybeSingle();
  if (error || !s) return Response.json({ ok: false, skipped: "settings" }, { status: 503 });
  if (!s.enabled || !s.release_gate) return Response.json({ ok: true, skipped: "disabled" });
  if (!s.updated_by) return Response.json({ ok: false, skipped: "no_actor" }, { status: 409 });
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: s.updated_by, _role: "admin" });
  if (isAdmin !== true) return Response.json({ ok: false, skipped: "actor_not_admin" }, { status: 409 });
  try {
    const r = await runLogged(sb, s.updated_by, "scheduled", await graph());
    return Response.json({ ok: true, agenda: r.agenda.status, planner: r.planner.map((p) => p.status) });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
