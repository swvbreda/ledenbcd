/**
 * Automatische volledige-jaarsync met Informer.
 *
 * Er bestaat geen handmatige knop meer: het geselecteerde boekjaar wordt altijd
 * als complete dataset opgehaald via `informer-sync?action=sync_year&year=<jaar>`.
 * Deze module bevat uitsluitend pure beslissingslogica, zodat ze testbaar is.
 */

export const YEAR_SYNC_STALE_MS = 15 * 60 * 1000;

export interface SyncLogRow {
  action?: string | null;
  success?: boolean | null;
  run_at?: string | null;
  items_processed?: number | null;
  error_message?: string | null;
  details?: { year?: number | string | null } | null;
}

function isYearSyncRow(row: SyncLogRow, year: number): boolean {
  if (!String(row?.action ?? "").includes("sync_year")) return false;
  const logged = row?.details?.year;
  if (logged === undefined || logged === null || logged === "") return false;
  return Number(logged) === year;
}

/** Laatste geslaagde volledige jaarsync voor precies dit boekjaar (details.year). */
export function lastSuccessfulYearSync(log: SyncLogRow[], year: number): SyncLogRow | null {
  const rows = (log ?? [])
    .filter((l) => isYearSyncRow(l, year) && !!l?.success && !!l?.run_at)
    .sort((a, b) => String(a.run_at).localeCompare(String(b.run_at)));
  return rows.length ? rows[rows.length - 1]! : null;
}

export function lastSuccessfulYearSyncAt(log: SyncLogRow[], year: number): string | null {
  return lastSuccessfulYearSync(log, year)?.run_at ?? null;
}

export interface ShouldSyncInput {
  log: SyncLogRow[];
  year: number;
  now: number;
  /** Tijdstip (ms) van de laatste poging in deze sessie, ook een mislukte. */
  lastAttemptAt?: number | null;
  /** Er loopt al een request voor dit jaar. */
  inFlight?: boolean;
  /** Logs zijn nog niet geladen; dan nog niets starten. */
  logLoaded?: boolean;
  staleMs?: number;
}

/**
 * Start alleen als er voor dit jaar geen geslaagde sync bestaat of die ouder is
 * dan de drempel, er geen request loopt en de vorige poging (ook een mislukte)
 * langer dan de drempel geleden was. Zo ontstaat na een fout geen retry-loop.
 */
export function shouldStartYearSync(input: ShouldSyncInput): boolean {
  const staleMs = input.staleMs ?? YEAR_SYNC_STALE_MS;
  if (input.logLoaded === false) return false;
  if (input.inFlight) return false;
  if (input.lastAttemptAt != null && input.now - input.lastAttemptAt < staleMs) return false;
  const last = lastSuccessfulYearSyncAt(input.log ?? [], input.year);
  if (!last) return true;
  const ts = new Date(last).getTime();
  if (!Number.isFinite(ts)) return true;
  return input.now - ts >= staleMs;
}
