/**
 * Single-flight + generation-guarded loader for a user's verified rights.
 *
 * Why: the auth bootstrap (getSession) and the INITIAL_SESSION / TOKEN_REFRESHED
 * callbacks each started their own rights check. On a slow backend those checks
 * overlapped, raced each other's refreshSession (refresh_token_already_used) and an
 * old 20s timeout could wipe rights that a newer check had already verified.
 *
 * Rules enforced here:
 * - One in-flight load per user; overlapping requests share it.
 * - Every state write is tied to a generation; stale results/errors/timeouts are dropped.
 * - A timeout never clears rights that are verified for the current user.
 * - A load that finishes after its own timeout (same generation, no newer attempt) may
 *   still apply its verified result, so a slow-but-successful check recovers.
 * - Rights are only granted from a successful load (status "ready").
 */

export interface AccessSnapshot {
  roles: string[];
  memberIds: number[];
  isBoard: boolean;
}

export type AccessState =
  | { status: "idle"; userId: null }
  | { status: "loading"; userId: string }
  | { status: "ready"; userId: string; access: AccessSnapshot }
  | { status: "error"; userId: string; message: string };

export const IDLE_ACCESS: AccessState = { status: "idle", userId: null };

export interface AccessControllerOptions {
  load: (userId: string) => Promise<AccessSnapshot>;
  onChange: (state: AccessState) => void;
  timeoutMs: number;
  timeoutLabel?: string;
  onBackgroundError?: (error: unknown) => void;
}

export function createAccessController(opts: AccessControllerOptions) {
  let generation = 0;
  let state: AccessState = IDLE_ACCESS;
  let inFlight: { userId: string; gen: number; timedOut: boolean; promise: Promise<void> } | null = null;
  let disposed = false;

  const set = (next: AccessState) => {
    state = next;
    if (!disposed) opts.onChange(next);
  };

  const isReadyFor = (userId: string) => state.status === "ready" && state.userId === userId;

  function ensure(userId: string, options: { force?: boolean } = {}): Promise<void> {
    if (disposed) return Promise.resolve();
    // Single-flight: share a live (not timed-out) load for the same user.
    if (inFlight && inFlight.userId === userId && !inFlight.timedOut) return inFlight.promise;
    if (!options.force && isReadyFor(userId)) return Promise.resolve();

    const gen = ++generation;
    const background = isReadyFor(userId); // forced re-check while rights are verified
    if (!background) set({ status: "loading", userId });

    const entry = { userId, gen, timedOut: false, promise: Promise.resolve() };
    const timer = setTimeout(() => {
      if (gen !== generation) return;
      entry.timedOut = true;
      // Never clear rights that are verified for this user.
      if (isReadyFor(userId)) return;
      const label = opts.timeoutLabel ?? "Het laden van gebruikersrechten";
      set({
        status: "error",
        userId,
        message: `${label} reageerde niet binnen ${Math.round(opts.timeoutMs / 1000)} seconden`,
      });
    }, opts.timeoutMs);

    entry.promise = opts
      .load(userId)
      .then(
        (access) => {
          if (gen !== generation) return;
          set({ status: "ready", userId, access });
        },
        (error) => {
          if (gen !== generation) return;
          if (isReadyFor(userId)) {
            opts.onBackgroundError?.(error);
            return;
          }
          set({
            status: "error",
            userId,
            message: error instanceof Error ? error.message : "Rechten konden niet worden geladen",
          });
        },
      )
      .finally(() => {
        clearTimeout(timer);
        if (inFlight === entry) inFlight = null;
      });
    inFlight = entry;
    return entry.promise;
  }

  /** Sign-out / no session: drop rights and invalidate every pending load. */
  function reset() {
    generation += 1;
    inFlight = null;
    set(IDLE_ACCESS);
  }

  function dispose() {
    generation += 1;
    inFlight = null;
    disposed = true;
  }

  return { ensure, reset, dispose, getState: () => state };
}

/** Shares one pending call between concurrent callers (e.g. refreshSession). */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = fn().finally(() => {
        pending = null;
      });
    }
    return pending;
  };
}

export interface DerivedAccess {
  loading: boolean;
  isAdmin: boolean;
  isExtern: boolean;
  isBoard: boolean;
  linkedMemberIds: number[];
  accessError: string | null;
}

/**
 * Rights exist only when the verified snapshot belongs to the current session user.
 * While a user is known but not yet verified, the app keeps loading (no redirect, no rights).
 */
export function deriveAccess(input: {
  sessionPending: boolean;
  userId: string | null;
  access: AccessState;
}): DerivedAccess {
  const none = { isAdmin: false, isExtern: false, isBoard: false, linkedMemberIds: [] as number[] };
  if (input.sessionPending) return { loading: true, accessError: null, ...none };
  if (!input.userId) return { loading: false, accessError: null, ...none };
  const a = input.access;
  if (a.status === "idle" || a.userId !== input.userId || a.status === "loading") {
    return { loading: true, accessError: null, ...none };
  }
  if (a.status === "error") return { loading: false, accessError: a.message, ...none };
  return {
    loading: false,
    accessError: null,
    isAdmin: a.access.roles.includes("admin"),
    isExtern: a.access.roles.includes("extern"),
    isBoard: a.access.isBoard,
    linkedMemberIds: a.access.memberIds,
  };
}
