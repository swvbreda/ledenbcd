// Na een nieuwe publicatie bestaan oude paginabestanden niet meer; een open tab laadt dan eenmalig opnieuw.
const KEY = "bcd-stale-chunk-reload";
const WINDOW_MS = 30_000;

export function isStaleChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

/** Herlaadt maximaal één keer per 30 seconden, zodat er nooit een herlaadlus ontstaat. */
export function reloadOnceForStaleChunk(): boolean {
  if (typeof window === "undefined") return false;
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < WINDOW_MS) return false;
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
  return true;
}

export function installStaleChunkHandler(): () => void {
  const onPreload = (event: Event) => {
    if (reloadOnceForStaleChunk()) event.preventDefault();
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (isStaleChunkError(event.reason)) reloadOnceForStaleChunk();
  };
  window.addEventListener("vite:preloadError", onPreload);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("vite:preloadError", onPreload);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
