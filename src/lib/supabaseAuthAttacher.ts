import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Stuurt het inlogtoken van de ingelogde gebruiker mee met elke serverfunctie,
 * zodat functies met requireSupabaseAuth de gebruiker herkennen.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let headers: Record<string, string> = {};
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers = { Authorization: `Bearer ${token}` };
    } catch {
      // geen sessie beschikbaar: zonder token doorgaan
    }
    return next({ headers });
  },
);
