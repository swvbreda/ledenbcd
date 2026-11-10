import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAuthBearer } from "@/lib/authBearer";
import { withAuthTimeout } from "@/lib/authAccess";

/** Resolve the bearer: Auth-event token first, bounded storage fallback otherwise. */
export async function resolveBearer(): Promise<string | null> {
  const delivered = getAuthBearer();
  if (delivered.delivered) return delivered.token;
  try {
    const { data } = await withAuthTimeout(supabase.auth.getSession(), 10000, "De inlogservice");
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Stuurt het inlogtoken van de ingelogde gebruiker mee met elke serverfunctie,
 * zodat functies met requireSupabaseAuth de gebruiker herkennen. De server
 * verifieert het token altijd zelf.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await resolveBearer();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
