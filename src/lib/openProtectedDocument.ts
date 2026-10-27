export type OpenTarget = "native" | "web";

/** Only https signed links from the members' API may be opened. */
export function assertSafeDocumentUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Geen geldige downloadlink ontvangen");
  return parsed.toString();
}

/**
 * Native (Capacitor) webview: navigating to an external https host is handed to the
 * system browser by Capacitor, which shows/saves the PDF. Web: a link opened after an
 * await is blocked by Safari/iOS popup rules, so the caller shows a tap-to-open link.
 */
export function openInNativeShell(url: string, assign: (url: string) => void = u => window.location.assign(u)) {
  assign(assertSafeDocumentUrl(url));
}
