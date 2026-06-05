import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "sso_redirect_to";

/** Hosts die we toestaan als redirect-doel na login. */
const ALLOWED_HOSTS = [
  "coffeeshopbond.nl",
  "www.coffeeshopbond.nl",
  "coffeeshopbond.lovable.app",
  "localhost",
  "127.0.0.1",
];

function isAllowed(url: URL): boolean {
  if (ALLOWED_HOSTS.includes(url.hostname)) return true;
  // Subdomeinen van coffeeshopbond.nl toestaan
  if (url.hostname.endsWith(".coffeeshopbond.nl")) return true;
  // *.lovable.app previews van het publieke project toestaan
  if (url.hostname.endsWith(".lovable.app") && url.hostname.includes("coffeeshopbond")) return true;
  return false;
}

/** Lees `redirect_to` uit de query en bewaar veilig in sessionStorage. */
export function captureRedirectFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("redirect_to");
    if (!raw) return;
    const url = new URL(raw, window.location.origin);
    if (!isAllowed(url)) {
      console.warn("[sso] redirect_to host niet toegestaan:", url.hostname);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, url.toString());
  } catch (e) {
    console.warn("[sso] kon redirect_to niet parsen", e);
  }
}

/** Haal opgeslagen redirect op (en wis hem). */
function consumeRedirect(): string | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v) sessionStorage.removeItem(STORAGE_KEY);
    return v;
  } catch {
    return null;
  }
}

export function hasPendingRedirect(): boolean {
  try {
    return !!sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

/**
 * Bouw de redirect-URL met Supabase tokens in de URL-hash en navigeer.
 * Geeft `true` terug wanneer er daadwerkelijk geredirect wordt.
 */
export async function maybeRedirectAfterLogin(): Promise<boolean> {
  const target = consumeRedirect();
  if (!target) return false;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    console.warn("[sso] geen sessie beschikbaar voor redirect");
    return false;
  }

  const s = data.session;
  const hashParams = new URLSearchParams({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_in: String(s.expires_in ?? ""),
    expires_at: String(s.expires_at ?? ""),
    token_type: s.token_type ?? "bearer",
    type: "sso",
  });

  // Hash i.p.v. query — tokens komen niet in server-logs of Referer terecht
  const url = new URL(target);
  url.hash = hashParams.toString();
  window.location.replace(url.toString());
  return true;
}