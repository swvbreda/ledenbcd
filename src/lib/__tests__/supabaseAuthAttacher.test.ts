import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: () => getSession() } } }));

import { resolveBearer } from "../supabaseAuthAttacher";
import { resetAuthBearerForTests, setAuthBearer } from "../authBearer";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const sessionOf = (t: string) => ({ data: { session: { access_token: t } } });

describe("server-function bearer", () => {
  beforeEach(() => { resetAuthBearerForTests(); getSession.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it("uses the Auth-delivered token without reading storage", async () => {
    setAuthBearer("tok-1");
    expect(await resolveBearer()).toBe("tok-1");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("sends no token after sign-out", async () => {
    setAuthBearer("tok-1");
    setAuthBearer(null);
    expect(await resolveBearer()).toBeNull();
  });

  it("falls back to storage before any Auth event", async () => {
    getSession.mockResolvedValue(sessionOf("tok-2"));
    expect(await resolveBearer()).toBe("tok-2");
  });

  it("does not hang when storage never answers (bounded)", async () => {
    vi.useFakeTimers();
    getSession.mockReturnValue(new Promise(() => {}));
    const p = resolveBearer();
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await p).toBeNull();
  });

  it("ignores a late old fallback after a token refresh", async () => {
    const d = deferred<ReturnType<typeof sessionOf>>();
    getSession.mockReturnValue(d.promise);
    const p = resolveBearer();
    setAuthBearer("refreshed");
    d.resolve(sessionOf("old"));
    expect(await p).toBe("refreshed");
  });

  it("ignores a late old fallback after an account switch", async () => {
    const d = deferred<ReturnType<typeof sessionOf>>();
    getSession.mockReturnValue(d.promise);
    const p = resolveBearer();
    setAuthBearer("user-b");
    d.resolve(sessionOf("user-a"));
    expect(await p).toBe("user-b");
  });

  it("ignores a late old fallback after sign-out", async () => {
    const d = deferred<ReturnType<typeof sessionOf>>();
    getSession.mockReturnValue(d.promise);
    const p = resolveBearer();
    setAuthBearer(null);
    d.resolve(sessionOf("old"));
    expect(await p).toBeNull();
  });
});
