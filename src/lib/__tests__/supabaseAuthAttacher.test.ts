import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: () => getSession() } } }));

import { resolveBearer } from "../supabaseAuthAttacher";
import { resetAuthBearerForTests, setAuthBearer } from "../authBearer";

describe("server-function bearer", () => {
  beforeEach(() => {
    resetAuthBearerForTests();
    getSession.mockReset();
  });

  it("uses the Auth-delivered token without reading storage", async () => {
    setAuthBearer("tok-1");
    expect(await resolveBearer()).toBe("tok-1");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("sends no token after sign-out", async () => {
    setAuthBearer("tok-1");
    setAuthBearer(null);
    expect(await resolveBearer()).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("falls back to storage before any Auth event", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok-2" } } });
    expect(await resolveBearer()).toBe("tok-2");
  });

  it("does not hang when storage never answers", async () => {
    vi.useFakeTimers();
    getSession.mockReturnValue(new Promise(() => {}));
    const p = resolveBearer();
    await vi.advanceTimersByTimeAsync(10001);
    expect(await p).toBeNull();
    vi.useRealTimers();
  });
});
