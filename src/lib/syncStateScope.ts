/**
 * Scope voor het lezen van de Informer-synclog. RLS geeft anoniem of zonder
 * rol een lege lijst (geen fout); die mag nooit als "geverifieerde log" in de
 * cache komen. Daarom: sleutel per gebruiker en pas lezen na auth + rol.
 */
export const SYNC_STATE_KEY = "informer-sync-state" as const;

export interface SyncStateAuth {
  loading: boolean;
  userId: string | null | undefined;
  isAdmin: boolean;
  isBoard: boolean;
}

export function syncStateQueryKey(userId: string | null | undefined) {
  return [SYNC_STATE_KEY, userId ?? "anon"] as const;
}

export function syncStateEnabled(auth: SyncStateAuth): boolean {
  return !auth.loading && !!auth.userId && (auth.isAdmin || auth.isBoard);
}

/**
 * Leest de synclog alleen met een sessie van precies deze gebruiker. Zonder bearer
 * token geeft RLS stil [] terug; dat mag nooit als "nog nooit gesynchroniseerd" in de
 * cache landen, dus gooien we in dat geval een fout (React Query probeert opnieuw).
 */
export function assertSyncSessionMatches(sessionUserId: string | null | undefined, expectedUserId: string | null | undefined): void {
  if (!expectedUserId || !sessionUserId || sessionUserId !== expectedUserId) {
    throw new Error("Sessie nog niet geverifieerd; synchronisatielog niet gelezen");
  }
}

/** Kolommen die de UI nodig heeft; `api_calls` (honderden KB per regel) bewust niet. */
export const SYNC_LOG_COLUMNS = "id, run_at, action, success, items_processed, error_message, details" as const;
export const SYNC_READ_TIMEOUT_MS = 15_000;

export function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} reageerde niet binnen ${Math.round(ms / 1000)} seconden`)), ms);
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

type Res = { data: any; error: any };
export interface SyncStateFetchers {
  getSessionUserId: () => PromiseLike<string | null | undefined>;
  state: () => PromiseLike<Res>;
  recent: () => PromiseLike<Res>;
  year: () => PromiseLike<Res>;
}
export interface SyncStateResult {
  state: any | null;
  log: any[];
  /** Fout van de niet-essentiële statusregel; maskeert de jaarsynclog niet. */
  stateError: string | null;
  recentError: string | null;
}

const msg = (e: any) => (e instanceof Error ? e.message : e?.message ?? String(e));

/**
 * Leest state/recent/jaarlog afzonderlijk met eigen time-out. Alleen de jaarsynclog
 * is essentieel: faalt die, dan een echte fout (geen lege "nooit gesynchroniseerd").
 */
export async function loadSyncState(
  f: SyncStateFetchers,
  expectedUserId: string | null | undefined,
  timeoutMs = SYNC_READ_TIMEOUT_MS,
): Promise<SyncStateResult> {
  const sessionUserId = await withTimeout(f.getSessionUserId(), timeoutMs, "Sessiecontrole");
  assertSyncSessionMatches(sessionUserId, expectedUserId);
  const run = async (fn: () => PromiseLike<Res>, label: string) => {
    const r = await withTimeout(fn(), timeoutMs, label);
    if (r.error) throw new Error(`${label}: ${msg(r.error)}`);
    return r.data;
  };
  const [stateR, recentR, yearR] = await Promise.allSettled([
    run(f.state, "Synchronisatiestatus"),
    run(f.recent, "Recente synclog"),
    run(f.year, "Jaarsynclog"),
  ]);
  if (yearR.status === "rejected") throw yearR.reason;
  const byId = new Map<string, any>();
  const recent = recentR.status === "fulfilled" ? recentR.value ?? [] : [];
  for (const row of [...recent, ...(yearR.value ?? [])]) byId.set(String(row.id ?? row.run_at), row);
  const log = Array.from(byId.values()).sort((a, b) => String(b.run_at).localeCompare(String(a.run_at)));
  return {
    state: stateR.status === "fulfilled" ? stateR.value ?? null : null,
    log,
    stateError: stateR.status === "rejected" ? msg(stateR.reason) : null,
    recentError: recentR.status === "rejected" ? msg(recentR.reason) : null,
  };
}
