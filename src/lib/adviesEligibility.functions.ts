import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Geeft voor de ingelogde BCD-gebruiker een eenmalige code uit, of een weigerreden. Nooit e-mail/token. */
export const issueAdviesCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return { challenge: o["challenge"], method: o["method"], audience: o["audience"] };
  })
  .handler(async ({ data, context }) => {
    // Opnieuw valideren bij de inlogservice (niet alleen de JWT-claims).
    const { data: u, error } = await context.supabase.auth.getUser();
    if (error || !u.user || u.user.id !== context.userId) return { ok: false as const, reason: "not_signed_in" as const };
    const { issueEligibilityCode } = await import("./adviesEligibility");
    const { serviceEligibilityStore } = await import("./adviesEligibility.server");
    try {
      return await issueEligibilityCode(await serviceEligibilityStore(), { userId: u.user.id, ...data });
    } catch {
      return { ok: false as const, reason: "unavailable" as const };
    }
  });
