import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Next = (input: { headers: Record<string, string> }) => Promise<unknown>;
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createClient: vi.fn((_url: string, _key: string, options: unknown) => ({ options })),
  middleware: undefined as undefined | ((input: { next: Next }) => Promise<unknown>),
}));

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({ client: (handler: typeof mocks.middleware) => {
    mocks.middleware = handler;
    return handler;
  } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: () => mocks.getSession() } },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { AUTH_TRANSPORT_RETRY_MESSAGE } from "../supabaseAuthAttacher";
import { callerSupabase } from "../callerClient";
import { resetAuthBearerForTests, setAuthBearer } from "../authBearer";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const sessionOf = (token: string) => ({ data: { session: { access_token: token } } });
const request = (next: Next) => mocks.middleware!({ next });
let sequence = 0;

describe("auth generation at the request boundary", () => {
  beforeEach(() => {
    resetAuthBearerForTests();
    mocks.getSession.mockReset();
    mocks.createClient.mockClear();
    sequence += 1;
  });
  afterEach(() => { vi.useRealTimers(); });

  it("sends both requests without storage when the delivered session stays current", async () => {
    const token = `stable-${sequence}`;
    setAuthBearer(token);
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    const next = vi.fn().mockResolvedValue("sent");
    await request(next);
    await callerSupabase();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith({ headers: { Authorization: `Bearer ${token}` } });
    expect(mocks.createClient.mock.calls[0]?.[2]).toMatchObject({
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  });

  it("keeps a known sign-out unauthenticated without a storage fallback or client", async () => {
    setAuthBearer(null);
    const next = vi.fn().mockResolvedValue("sent");
    await request(next);
    await expect(callerSupabase()).rejects.toThrow("Log opnieuw in");
    expect(next).toHaveBeenCalledWith({ headers: {} });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each(["refresh", "account switch", "sign-out"] as const)(
    "rejects both old requests when %s occurs after token resolution starts",
    async (change) => {
      setAuthBearer(`old-${sequence}`);
      const next = vi.fn().mockResolvedValue("sent");
      const pendingRequest = request(next);
      const pendingClient = callerSupabase();
      const token = change === "sign-out" ? null : `${change}-${sequence}`;
      setAuthBearer(token);
      await expect(pendingRequest).rejects.toThrow(AUTH_TRANSPORT_RETRY_MESSAGE);
      await expect(pendingClient).rejects.toThrow(AUTH_TRANSPORT_RETRY_MESSAGE);
      expect(next).not.toHaveBeenCalled();
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.getSession).not.toHaveBeenCalled();

      // A new request belongs to the new session; the old request never changes identity.
      if (token) {
        await request(next);
        await callerSupabase();
        expect(next).toHaveBeenCalledWith({ headers: { Authorization: `Bearer ${token}` } });
        expect(mocks.createClient.mock.calls[0]?.[2]).toMatchObject({
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
      } else {
        await expect(callerSupabase()).rejects.toThrow("Log opnieuw in");
        expect(mocks.createClient).not.toHaveBeenCalled();
      }
    },
  );

  it.each(["resolve", "reject", "timeout"] as const)(
    "rejects old fallback requests after any Auth change when storage ends by %s",
    async (outcome) => {
      vi.useFakeTimers();
      for (const change of ["refresh", "account switch", "sign-out"] as const) {
        resetAuthBearerForTests();
        mocks.getSession.mockReset();
        mocks.createClient.mockClear();
        const storage = deferred<ReturnType<typeof sessionOf>>();
        mocks.getSession.mockReturnValue(storage.promise);
        const next = vi.fn().mockResolvedValue("sent");
        const pendingRequest = request(next);
        const pendingClient = callerSupabase();
        const checked = Promise.all([
          expect(pendingRequest).rejects.toThrow(AUTH_TRANSPORT_RETRY_MESSAGE),
          expect(pendingClient).rejects.toThrow(AUTH_TRANSPORT_RETRY_MESSAGE),
        ]);
        setAuthBearer(change === "sign-out" ? null : `${change}-${sequence}-${outcome}`);
        if (outcome === "resolve") storage.resolve(sessionOf("old-storage-token"));
        else if (outcome === "reject") storage.reject(new Error("storage failed"));
        else await vi.advanceTimersByTimeAsync(10_001);
        await checked;
        expect(next).not.toHaveBeenCalled();
        expect(mocks.createClient).not.toHaveBeenCalled();
      }
    },
  );
});
