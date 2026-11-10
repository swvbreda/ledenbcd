import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveBearer } from "@/lib/supabaseAuthAttacher";

/**
 * Non-persistent database client carrying the caller's verified-by-server token,
 * so direct table reads never wait on broker session storage. RLS still applies.
 */
/**
 * Uses the `accessToken` option, so the client has no own GoTrue instance: no shared
 * navigator lock / initialize / getSession before each request (those waited behind the
 * main client's pending broker session read and hung rights + table queries).
 */
export function makeCallerClient(token: string, fetchImpl?: typeof fetch): SupabaseClient<Database> {
  return createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => token,
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

let cached: { token: string; client: SupabaseClient<Database> } | null = null;

export async function callerSupabase(): Promise<SupabaseClient<Database>> {
  const token = await resolveBearer();
  if (!token) throw new Error("Log opnieuw in om verder te gaan.");
  if (cached?.token !== token) {
    cached = {
      token,
      client: makeCallerClient(token),
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
