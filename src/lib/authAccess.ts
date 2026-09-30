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
