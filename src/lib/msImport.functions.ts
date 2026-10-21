/** Beheeracties eenrichtingsimport. Alleen beheerders; Microsoft wordt uitsluitend gelezen. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IMPORT_MAILBOX } from "@/lib/msImport";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Geen toegang: alleen beheerders.");
}
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

async function port() {
  const g = await import("@/lib/plannerGraph.server");
  const { importGraphPort, readOnlyGraph } = await import("@/lib/msImportGraph.server");
  const cfg = g.readGraphConfig(process.env);
  if (!cfg) throw new Error("Microsoft-koppeling niet ingesteld (servergegevens ontbreken).");
  const { token, roles } = await g.getAppToken(cfg);
  return { roles, p: importGraphPort(readOnlyGraph(g.makeGraphClient(token))) };
}

/** Agenda's van de vaste postbus; de standaard (persoonlijke) agenda is nooit kiesbaar. */
export const msImportListCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    try {
      const { p } = await port();
      const userId = await p.resolveUser(IMPORT_MAILBOX);
      const cals = await p.listCalendars(userId);
      return { ok: true as const, mailbox: IMPORT_MAILBOX, calendars: cals.map((c) => ({ id: c.id, name: c.name, selectable: !c.isDefault })) };
    } catch (e) {
      return { ok: false as const, mailbox: IMPORT_MAILBOX, error: errText(e) };
    }
  });

/** Bevestigt exact één aparte agenda op id (naam alleen ter weergave), na serverzijdige hercontrole. */
export const msImportConfirmCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ calendarId: z.string().min(1).max(512).regex(/^[A-Za-z0-9_=+/-]+$/).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.calendarId === null) {
      const { error } = await supabaseAdmin.rpc("ms_import_configure" as any, { _actor: ctx.userId, _patch: { agenda_calendar_id: null, agenda_user_id: null, agenda_calendar_name: null } });
      if (error) throw new Error(error.message);
      return { ok: true, name: null };
    }
    const { p } = await port();
    const userId = await p.resolveUser(IMPORT_MAILBOX);
    const cal = (await p.listCalendars(userId)).find((c) => c.id === data.calendarId);
    if (!cal) throw new Error("Deze agenda hoort niet bij de BCD-postbus.");
    if (cal.isDefault) throw new Error("De standaard (persoonlijke) agenda mag nooit worden gekozen.");
    const { error } = await supabaseAdmin.rpc("ms_import_configure" as any, { _actor: ctx.userId, _patch: { agenda_calendar_id: cal.id, agenda_user_id: userId, agenda_calendar_name: cal.name.slice(0, 200) } });
    if (error) throw new Error(error.message);
    return { ok: true, name: cal.name };
  });

/** Kiest (of wist) de algemene bucket waarvan taken als onverwerkte bronlijst binnenkomen. */
export const msImportSetGeneralBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bucketId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    let name: string | null = null;
    if (data.bucketId) {
      const g = await import("@/lib/plannerGraph.server");
      const { IMPORT_PLAN_ID: PLANNER_TARGET_PLAN_ID } = await import("@/lib/msImport");
      const cfg = g.readGraphConfig(process.env);
      if (!cfg) throw new Error("Microsoft-koppeling niet ingesteld.");
      const { token } = await g.getAppToken(cfg);
      const b = (await g.plannerPort(g.makeGraphClient(token)).listBuckets(PLANNER_TARGET_PLAN_ID)).find((x) => x.id === data.bucketId);
      if (!b) throw new Error("Bucket hoort niet bij plan 'To do'.");
      const { data: used } = await ctx.supabase.from("planner_project_links").select("project_id").eq("bucket_id", b.id).maybeSingle();
      if (used) throw new Error("Deze bucket is al aan een project gekoppeld.");
      name = b.name;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("ms_import_configure" as any, { _actor: ctx.userId, _patch: { planner_general_bucket_id: data.bucketId, planner_general_bucket_name: name } });
    if (error) throw new Error(error.message);
    return { ok: true, name };
  });

/** Schakelaar voor geplande import; werkt pas mét releasegate (alleen via gereviewde databasewijziging). */
export const msImportSetEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("ms_import_configure" as any, { _actor: ctx.userId, _patch: { enabled: data.enabled } });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Handmatige import nu: zelfde worker als de geplande aanroep. */
export const msImportRunNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { runLogged, liveImportGraph } = await import("@/lib/msImportWorker.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runLogged(supabaseAdmin, ctx.userId, "manual", await liveImportGraph(process.env));
  });
