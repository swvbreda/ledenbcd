import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveBearer } from "@/lib/supabaseAuthAttacher";

/**
 * Non-persistent database client carrying the caller's verified-by-server token,
 * so direct table reads never wait on broker session storage. RLS still applies.
 */
let cached: { token: string; client: SupabaseClient<Database> } | null = null;

export async function callerSupabase(): Promise<SupabaseClient<Database>> {
  const token = await resolveBearer();
  if (!token) throw new Error("Log opnieuw in om verder te gaan.");
  if (cached?.token !== token) {
    cached = {
      token,
      client: createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }),
    };
  }
  return cached.client;
}

/** Abort signal that fires after `ms` or when `parent` aborts. */
export function boundedSignal(ms: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), ms);
  parent?.addEventListener("abort", () => controller.abort(parent.reason), { once: true });
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller.signal;
}
