import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAuthBearer } from "@/lib/authBearer";
import { withAuthTimeout } from "@/lib/authAccess";

export const BEARER_FALLBACK_MS = 10_000;
export const AUTH_TRANSPORT_RETRY_MESSAGE = "Je sessie is gewijzigd. Probeer opnieuw.";

/**
 * Resolve the bearer: Auth-event token first; before any Auth event a bounded
 * storage read. A fallback result is discarded when an Auth event (refresh,
 * account switch, sign-out) arrived while it was pending.
 */
export async function resolveBearer(): Promise<string | null> {
  const start = getAuthBearer();
  if (start.delivered) return start.token;
  let token: string | null = null;
  try {
    const { data } = await withAuthTimeout(supabase.auth.getSession(), BEARER_FALLBACK_MS, "De inlogservice");
    token = data.session?.access_token ?? null;
  } catch {
    token = null;
  }
  const now = getAuthBearer();
  if (now.generation !== start.generation) return now.token;
  return token;
}

/**
 * Stuurt het inlogtoken van de ingelogde gebruiker mee met elke serverfunctie,
 * zodat functies met requireSupabaseAuth de gebruiker herkennen. De server
 * verifieert het token altijd zelf.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const generation = getAuthBearer().generation;
    const token = await resolveBearer();
    // Never resume an old request under a refreshed or different session.
    if (getAuthBearer().generation !== generation) {
      throw new Error(AUTH_TRANSPORT_RETRY_MESSAGE);
    }
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);

