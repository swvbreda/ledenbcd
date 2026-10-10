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
