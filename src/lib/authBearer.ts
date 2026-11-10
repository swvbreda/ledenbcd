/**
 * In-memory transport of the access token delivered by Supabase Auth events.
 * Never persisted and never used for local authorization: the server verifies
 * every bearer. Each delivery bumps a generation so late fallback reads that
 * started before a refresh, account switch or sign-out are discarded.
 */
let bearer: string | null = null;
let delivered = false;
let generation = 0;

export function setAuthBearer(token: string | null) {
  bearer = token;
  delivered = true;
  generation += 1;
}

export function getAuthBearer(): { delivered: boolean; token: string | null; generation: number } {
  return { delivered, token: bearer, generation };
}

export function resetAuthBearerForTests() {
  bearer = null;
  delivered = false;
  generation = 0;
}
