import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAuthBearer } from './authBearer';
import { withAuthTimeout } from './authAccess';

/**
 * Stuurt het inlogtoken van de ingelogde gebruiker mee met elke serverfunctie,
 * zodat functies met requireSupabaseAuth de gebruiker herkennen.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const delivered=getAuthBearer();
    if(delivered)return next({headers:{Authorization:`Bearer ${delivered}`}});
    let headers: Record<string, string> = {};
    try {
      const { data } = await withAuthTimeout(supabase.auth.getSession(),10000,'De inlogservice');
      const token = data.session?.access_token;
      if (token) headers = { Authorization: `Bearer ${token}` };
    } catch {
      // geen sessie beschikbaar: zonder token doorgaan
    }
    return next({ headers });
  },
);
