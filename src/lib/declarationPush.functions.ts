import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Versnelling na indienen: verwerkt openstaande pushes voor één declaratie. Alleen de indiener
 * of een beheerder mag dit aanroepen; ontvangers komen uit de database-melding. Uit zolang
 * declaration_push_settings.enabled false is (claim geeft dan niets terug). Blijft de aanroep uit
 * (app gesloten), dan pakt de interne wekker dezelfde rij op via dezelfde claim.
 */
export const dispatchDeclarationPushes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ declarationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) {
      const { data: own } = await sb.from("internal_declarations").select("id").eq("id", data.declarationId).eq("submitted_by", context.userId).maybeSingle();
      if (!own) throw new Error("Geen toegang");
    }
    const { declarationPushPort, runDeclarationPushes } = await import("@/lib/declarationPush.server");
    const r = await runDeclarationPushes(process.env, await declarationPushPort(), data.declarationId);
    return { processed: r.processed };
  });
