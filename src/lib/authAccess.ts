type AuthAccessOptions = {
  expectedUserId: string;
  getAuthenticatedUserId: () => Promise<string | null>;
  fetchRoles: () => Promise<string[]>;
  refreshSession: () => Promise<void>;
  attempts?: number;
  retryDelayMs?: number;
};

const wait = (delayMs: number) =>
  delayMs > 0 ? new Promise<void>((resolve) => window.setTimeout(resolve, delayMs)) : Promise.resolve();

/**
 * Loads the authoritative database roles only after Supabase has confirmed the
 * current session. Native WebViews can restore local storage before the auth
 * client has installed its bearer token, so a first role request may otherwise
 * look like a valid user without any permissions.
 */
export async function fetchRolesWithSessionRecovery({
  expectedUserId,
  getAuthenticatedUserId,
  fetchRoles,
  refreshSession,
  attempts = 3,
  retryDelayMs = 250,
}: AuthAccessOptions): Promise<string[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const authenticatedUserId = await getAuthenticatedUserId();
      if (authenticatedUserId !== expectedUserId) {
        throw new Error("De herstelde sessie hoort niet bij de ingelogde gebruiker");
      }
      return await fetchRoles();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) break;
      try {
        await refreshSession();
      } catch (refreshError) {
        lastError = refreshError;
      }
      await wait(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gebruikersrechten konden niet worden geladen");
}

export class AuthTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} reageerde niet binnen ${Math.round(ms / 1000)} seconden`);
    this.name = "AuthTimeoutError";
  }
}

/** Rejects when `promise` does not settle within `ms`, so auth bootstrap can never hang forever. */
export function withAuthTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AuthTimeoutError(label, ms)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export type AuthBootstrapResult =
  | { status: "ok"; userId: string | null }
  | { status: "error"; message: string };

/**
 * Runs the auth bootstrap (session restore + access check) with a bounded wait.
 * Any rejection or timeout yields an error result; access is never granted on error.
 */
export async function runAuthBootstrap({
  getSessionUserId,
  loadAccess,
  sessionTimeoutMs = 15_000,
  accessTimeoutMs = 20_000,
}: {
  getSessionUserId: () => Promise<string | null>;
  loadAccess: (userId: string) => Promise<void>;
  sessionTimeoutMs?: number;
  accessTimeoutMs?: number;
}): Promise<AuthBootstrapResult> {
  try {
    const userId = await withAuthTimeout(getSessionUserId(), sessionTimeoutMs, "De inlogservice");
    if (userId) await withAuthTimeout(loadAccess(userId), accessTimeoutMs, "Het laden van gebruikersrechten");
    return { status: "ok", userId };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Onbekende fout bij inloggen" };
  }
}
