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
    const { error } = await supabaseAdmin.from("projectmail_settings").update({ enabled: data.enabled, updated_by: ctx.userId, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) return { ok: false as const, error: error.message };
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
