import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const created: Array<{ headers: Record<string, string> }> = [];
const rows = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: () => getSession() }, from: () => { throw new Error("generated client must not be used"); } } }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_u: string, _k: string, opts: { global: { headers: Record<string, string> } }) => {
    created.push({ headers: opts.global.headers });
    return { from: () => { const c: Record<string, unknown> = {}; c.select = () => c; c.order = () => c; c.range = () => c; c.abortSignal = () => rows(); return c; } };
  },
}));

import { addressBookQuery } from "../addressBookClient";
import { resetAuthBearerForTests, setAuthBearer } from "../authBearer";

const run = () => (addressBookQuery("u1").queryFn as (c: { signal: AbortSignal }) => Promise<unknown>)({ signal: new AbortController().signal });

describe("Contacten load", () => {
  beforeEach(() => { resetAuthBearerForTests(); getSession.mockReset(); rows.mockReset(); created.length = 0; });

  it("loads with the caller token while broker session storage hangs", async () => {
    getSession.mockReturnValue(new Promise(() => {}));
    setAuthBearer("tok-1");
    rows.mockResolvedValue({ data: [{ id: "a" }], error: null });
    const result = await run() as { organizations: unknown[]; contacts: unknown[] };
    expect(result.organizations).toHaveLength(1);
    expect(getSession).not.toHaveBeenCalled();
    expect(created[0].headers.Authorization).toBe("Bearer tok-1");
  });

  it("asks to sign in again when no token exists", async () => {
    setAuthBearer(null);
    await expect(run()).rejects.toThrow("Log opnieuw in");
  });

  it("gives a bounded timeout error instead of hanging", async () => {
    vi.useFakeTimers();
    setAuthBearer("tok-1");
    rows.mockReturnValue(new Promise(() => {}));
    const p = run();
    const assertion = expect(p).rejects.toThrow("niet op tijd");
    await vi.advanceTimersByTimeAsync(20_001);
    await assertion;
    vi.useRealTimers();
  });
});
