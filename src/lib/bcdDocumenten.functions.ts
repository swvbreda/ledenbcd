import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BronFout, CURSOR, DEFAULT_LIMIT, GM_CODE, MAX_LIMIT, deriveDocumentKey, fetchDocumenten, fetchGemeenten,
  resolveGmCode, sourceOrigin, type BcdGemeente, type DocumentenResultaat, type FoutReden,
} from "./bcdDocumenten";

type Ctx = { supabase: any; userId: string };

/** Admin, bestuur of actief gekoppeld lid (geen extern/inhuur/lead), via de actuele DB-rechten. */
async function mayRead(ctx: Ctx): Promise<boolean> {
  const [admin, board, member] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("is_board_member", { _user_id: ctx.userId }),
    ctx.supabase.rpc("support_my_member_id"),
  ]);
  return admin.data === true || board.data === true || (member.data != null && !member.error);
}

async function guard(ctx: Ctx): Promise<{ origin: string; key: string }> {
  if (!(await mayRead(ctx))) throw new BronFout("geen_toegang");
  const { data: ok } = await ctx.supabase.rpc("bcd_documenten_rate_hit");
  if (ok !== true) throw new BronFout("te_veel_verzoeken");
  const origin = sourceOrigin(process.env["BELEIDSMONITOR_BASE_URL"]);
  const base = process.env["BCD_KOPPEL_SLEUTEL"];
  if (!base) throw new BronFout("niet_geconfigureerd");
  return { origin, key: await deriveDocumentKey(base) };
}

// Korte cache van de openbare identiteitslijst (geen gebruikersdata).
let gemeentenCache: { at: number; lijst: BcdGemeente[] } | null = null;
async function gemeenten(origin: string, key: string) {
  if (gemeentenCache && Date.now() - gemeentenCache.at < 10 * 60_000) return gemeentenCache.lijst;
  const lijst = await fetchGemeenten(origin, key);
  gemeentenCache = { at: Date.now(), lijst };
  return lijst;
}

const fout = (e: unknown): { status: "fout"; reden: FoutReden } => {
  if (e instanceof BronFout) return { status: "fout", reden: e.reden };
  console.error("bcd-documenten: onverwachte fout");
  return { status: "fout", reden: "bron_onbereikbaar" };
};

export const getBcdGemeenten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ status: "ok"; gemeenten: BcdGemeente[] } | { status: "fout"; reden: FoutReden }> => {
    try {
      const { origin, key } = await guard(context as Ctx);
      const lijst = [...(await gemeenten(origin, key))].sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
      return { status: "ok", gemeenten: lijst };
    } catch (e) { return fout(e); }
  });

export const getBcdDocumenten = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    gemeentenaam: z.string().trim().min(1).max(120).optional(),
    gm_code: z.string().regex(GM_CODE).optional(),
    cursor: z.string().regex(CURSOR).nullable().default(null),
    limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  }).refine((v) => !!v.gemeentenaam !== !!v.gm_code).parse(d))
  .handler(async ({ data, context }): Promise<DocumentenResultaat> => {
    try {
      const { origin, key } = await guard(context as Ctx);
      const lijst = await gemeenten(origin, key);
      const gemeente = data.gm_code
        ? lijst.find((g) => g.gm_code === data.gm_code) ?? null
        : resolveGmCode(data.gemeentenaam!, lijst);
      if (!gemeente) return { status: "niet_gekoppeld" };
      const page = await fetchDocumenten(origin, key, gemeente.gm_code, data.cursor, data.limit);
      return { status: "ok", gemeente, ...page };
    } catch (e) { return fout(e); }
  });
