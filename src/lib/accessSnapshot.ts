import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AccessSnapshot } from "@/lib/accessController";
import { fetchRolesWithSessionRecovery } from "@/lib/authAccess";
import { handleRpcAuthError } from "@/lib/invokeFunction";
import { memberPasswordlessEnabled } from "@/lib/memberAccessFlag";
import { makeCallerClient } from "@/lib/callerClient";

/** Per-step budget; below the 20s overall limit so the error names the step that hung. */
export const ACCESS_STEP_TIMEOUT_MS = 15_000;

export class AccessStepTimeoutError extends Error {
  constructor(public step: string) {
    super(`Rechtencontrole: stap '${step}' reageerde niet op tijd`);
  }
}

function step<T>(label: string, p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new AccessStepTimeoutError(label)), ms);
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export interface AccessSnapshotDeps {
  /** Server-side token verification (GoTrue GET /user with explicit jwt; takes no session lock). */
  getUser: (token: string) => PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
  /** Main-client refresh; may wait on the auth lock, therefore bounded. */
  refreshSession: () => PromiseLike<{ data: { session: { user: { id: string }; access_token: string } | null }; error: unknown }>;
  makeClient?: (token: string) => SupabaseClient<Database>;
  stepTimeoutMs?: number;
}

/**
 * Loads verified rights with the Auth-delivered token. Every DB call uses a caller client
 * built with `accessToken` (no own GoTrue instance, so no shared navigator lock or
 * getSession before requests). RLS still applies; the auth server still verifies the token.
 */
export async function loadAccessSnapshot(userId: string, accessToken: string, deps: AccessSnapshotDeps): Promise<AccessSnapshot> {
  if (!accessToken) throw new Error("Geen geldige sessie voor de rechtencontrole");
  const ms = deps.stepTimeoutMs ?? ACCESS_STEP_TIMEOUT_MS;
  const make = deps.makeClient ?? makeCallerClient;
  let token = accessToken;
  let caller = make(token);

  const rolesPromise = fetchRolesWithSessionRecovery({
    expectedUserId: userId,
    getAuthenticatedUserId: async () => {
      const { data, error } = await step("tokencontrole", deps.getUser(token), ms);
      if (error) throw error;
      return data.user?.id ?? null;
    },
    fetchRoles: async () => {
      const { data, error } = await step("rollen", caller.from("user_roles").select("role").eq("user_id", userId), ms);
      if (error) throw error;
      return data?.map((row) => row.role) ?? [];
    },
    refreshSession: async () => {
      const { data, error } = await step("sessievernieuwing", deps.refreshSession(), ms);
      if (error) throw error;
      if (data.session?.user.id !== userId) {
        throw new Error("De vernieuwde sessie hoort niet bij de ingelogde gebruiker");
      }
      token = data.session.access_token;
      caller = make(token);
    },
  });

  const readProfileIds = async () => {
    const { data, error } = await step("ledenprofiel", caller.from("member_profiles").select("member_id").eq("user_id", userId), ms);
    if (error) throw error;
    return data?.map((p) => p.member_id) ?? [];
  };
  const memberIdsPromise = (async () => {
    const profilesPromise = memberPasswordlessEnabled ? null : readProfileIds();
    profilesPromise?.catch(() => {});
    let linked = 0;
    try {
      const { data: linkCount, error: linkError } = await step("ledenkoppeling", caller.rpc("ensure_member_link"), ms);
      if (linkError && handleRpcAuthError(linkError)) {
        throw new Error("Sessie verlopen tijdens het laden van de ledenkoppeling");
      }
      linked = typeof linkCount === "number" ? linkCount : 0;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Sessie verlopen")) throw e;
      console.warn("ensure_member_link mislukt", e instanceof Error ? e.message : "onbekend");
    }
    if (memberPasswordlessEnabled) {
      const { data, error } = await step("lidnummer", caller.rpc("current_member_id" as never), ms);
      if (error) throw error;
      return typeof data === "number" ? [data] : [];
    }
    return linked > 0 || !profilesPromise ? readProfileIds() : profilesPromise;
  })();
  const boardRowsPromise = step("bestuur", caller.from("board_members").select("lid_id, lid_ids"), ms)
    .then((r) => { if (r.error) throw r.error; return r.data ?? []; });

  memberIdsPromise.catch(() => {});
  boardRowsPromise.catch(() => {});
  const [roles, memberIds, boardRows] = await Promise.all([rolesPromise, memberIdsPromise, boardRowsPromise]);
  const isBoard =
    memberIds.length > 0 &&
    (boardRows as any[]).some((row) => {
      if (row?.lid_id && memberIds.includes(row.lid_id)) return true;
      const ids: number[] = Array.isArray(row?.lid_ids) ? row.lid_ids : [];
      return ids.some((id) => memberIds.includes(id));
    });
  return { roles, memberIds, isBoard };
}
