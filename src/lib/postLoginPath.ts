import { oauthReturnPath } from "./oauth-return-path";

const KEY = "post_login_path";

/** Bewaar het interne pad waar de gebruiker naartoe wilde vóór het inloggen. */
export function savePostLoginPath(path: string) {
  try {
    const safe = oauthReturnPath(path);
    if (safe === "/" || safe.startsWith("/login") || safe.startsWith("/mfa")) return;
    sessionStorage.setItem(KEY, safe);
  } catch {
    /* ignore */
  }
}

/** Haal het bewaarde pad op en wis het. */
export function consumePostLoginPath(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    const safe = oauthReturnPath(v);
    return safe === "/" ? null : safe;
  } catch {
    return null;
  }
}
