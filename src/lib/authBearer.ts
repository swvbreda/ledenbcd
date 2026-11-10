/**
 * In-memory transport of the access token delivered by Supabase Auth events.
 * Never persisted and never used for local authorization: the server verifies
 * every bearer. Avoids re-reading (possibly hanging) broker storage per call.
 */
let bearer: string | null = null;
let delivered = false;

export function setAuthBearer(token: string | null) {
  bearer = token;
  delivered = true;
}

export function getAuthBearer(): { delivered: boolean; token: string | null } {
  return { delivered, token: bearer };
}

export function resetAuthBearerForTests() {
  bearer = null;
  delivered = false;
}
