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
