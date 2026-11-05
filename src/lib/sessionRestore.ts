import { isTransientAuthError } from "@/lib/authAccess";

/**
 * Session restore/expiry decisions, kept pure so they can be tested without a backend.
 *
 * Why: supabase-js keeps a stored session when a token refresh fails for a transient
 * reason (network, timeout, 5xx), yet `getSession()` and the `INITIAL_SESSION` event then
 * report `session: null` for an access token that has already expired (supabase-js issue
 * #2748). Treating that null as "signed out" sent phone users to the login screen on cold
 * start/resume while their session was still valid. The library itself clears storage and
 * emits `SIGNED_OUT` only when the session is really dead, so that event stays authoritative.
 */

export type RefreshFailureKind = "transient" | "superseded" | "invalid";

/** Codes the auth server returns when a session can never be refreshed again. */
const DEFINITIVE_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "session_expired",
  "user_not_found",
  "user_banned",
  "bad_jwt",
]);

export function classifyRefreshFailure(error: unknown): RefreshFailureKind {
  const e = error as { name?: string; code?: string } | null;
  if (e?.code && DEFINITIVE_CODES.has(e.code)) return "invalid";
  // Another refresh rotated the token first; the stored session is the newer one.
  if (e?.name === "AuthRefreshDiscardedError") return "superseded";
  if (isTransientAuthError(error)) return "transient";
  return "invalid";
}

export type InitialSessionResult<S> =
  | { kind: "session"; session: S }
  | { kind: "signed_out" }
  | { kind: "reconnecting"; message: string };

export const RECONNECTING_MESSAGE =
  "Geen verbinding met de inlogservice. Je blijft ingelogd; we proberen het automatisch opnieuw.";

/**
 * Interprets the outcome of the bootstrap `getSession()` call.
 * A transient/superseded failure never becomes "signed out" and never grants rights.
 */
export function interpretInitialSession<S>(
  outcome: { session: S | null; error: unknown } | { thrown: unknown },
): InitialSessionResult<S> {
  if ("thrown" in outcome) {
    return classifyRefreshFailure(outcome.thrown) === "invalid"
      ? { kind: "signed_out" }
      : { kind: "reconnecting", message: RECONNECTING_MESSAGE };
  }
  if (outcome.session) return { kind: "session", session: outcome.session };
  if (!outcome.error) return { kind: "signed_out" };
  return classifyRefreshFailure(outcome.error) === "invalid"
    ? { kind: "signed_out" }
    : { kind: "reconnecting", message: RECONNECTING_MESSAGE };
}

/**
 * `INITIAL_SESSION` with a null session is ambiguous (no session vs transient refresh
 * failure); the bootstrap `getSession()` result decides that case instead.
 */
export function shouldIgnoreAuthEvent(event: string, hasSession: boolean): boolean {
  return event === "INITIAL_SESSION" && !hasSession;
}

/**
 * Decides whether an unrecoverable-looking auth failure (e.g. "jwt expired" from an RPC)
 * really ends the session. Only a definitive refusal by the auth server, or a session the
 * client no longer holds, signs out; a temporary outage or lost refresh race keeps it.
 */
export async function decideSessionExpiry(deps: {
  refresh: () => Promise<{ hasSession: boolean; error: unknown }>;
  getStoredSession: () => Promise<boolean>;
  isOnline: () => boolean;
}): Promise<"keep" | "sign_out"> {
  let refreshError: unknown = null;
  try {
    const { hasSession, error } = await deps.refresh();
    if (!error && hasSession) return "keep";
    refreshError = error;
  } catch (e) {
    refreshError = e;
  }
  if (!refreshError) return "sign_out"; // geen fout en geen sessie: er is niets om te bewaren
  const kind = classifyRefreshFailure(refreshError);
  if (kind === "transient") return "keep";
  if (!deps.isOnline()) return "keep";
  if (kind === "superseded") {
    try {
      return (await deps.getStoredSession()) ? "keep" : "sign_out";
    } catch {
      return "keep";
    }
  }
  return "sign_out";
}
