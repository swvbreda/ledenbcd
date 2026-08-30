const KEY = "post_login_path";

/** Bewaar het interne pad waar de gebruiker naartoe wilde vóór het inloggen. */
export function savePostLoginPath(path: string) {
  try {
    if (!path.startsWith("/") || path.startsWith("//")) return;
    if (path === "/" || path.startsWith("/login") || path.startsWith("/mfa")) return;
    sessionStorage.setItem(KEY, path);
  } catch {
    /* ignore */
  }
}

/** Haal het bewaarde pad op en wis het. */
export function consumePostLoginPath(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch {
    return null;
  }
}
