/** Beheeracties Projectmail. Alleen beheerders; Microsoft wordt uitsluitend gelezen. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Geen toegang: alleen beheerders.");
}

/** Verbindingsdiagnostiek; slaat alleen niet-gevoelige status op. */
export const projectMailCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { checkConnection, saveConnection } = await import("@/lib/projectMailWorker.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { result } = await checkConnection(process.env);
    await saveConnection(supabaseAdmin, result);
    return { state: result.state, detail: result.detail };
  });

/** Aan/uit. Aanzetten alleen na geslaagde verbindingscontrole (servercheck, niet de client). */
export const projectMailSetEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { checkConnection, saveConnection } = await import("@/lib/projectMailWorker.server");
      const { result } = await checkConnection(process.env);
      await saveConnection(supabaseAdmin, result);
      if (result.state !== "verbonden") return { ok: false as const, error: result.detail };
    }
    // Eén pad: DB-functie controleert opnieuw actuele beheerder, geïnstalleerde eigen job en recente verificatie, en zet instelling + job atomair.
    const { data: st, error } = await supabaseAdmin.rpc("projectmail_configure", { _enabled: data.enabled, _actor: ctx.userId });
    if (error) return { ok: false as const, error: error.message };
    const s = st as { installed: boolean; active: boolean; armed: boolean; enabled: boolean };
    if (data.enabled && !(s.installed && s.active && s.armed && s.enabled)) return { ok: false as const, error: "Automatische planning niet actief geworden." };
    return { ok: true as const };
  });

/** Handmatige run (zelfde worker + lease als gepland). */
export const projectMailRunNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runProjectMailLogged } = await import("@/lib/projectMailWorker.server");
    const r = await runProjectMailLogged(supabaseAdmin, ctx.userId, "manual", process.env);
    return { status: r.status, counts: r.counts ?? null, error: r.error ?? null };
  });

/** Status automatische planning (alleen metadata). */
export const projectMailSchedulerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("projectmail_scheduler_status");
    if (error) return { installed: false, active: false, armed: false, enabled: false, error: error.message };
    return { ...(data as { installed: boolean; active: boolean; armed: boolean; enabled: boolean }), error: null as string | null };
  });
