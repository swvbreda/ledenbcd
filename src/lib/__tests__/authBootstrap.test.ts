import { describe, expect, it, vi } from "vitest";
import { runAuthBootstrap, withAuthTimeout, AuthTimeoutError } from "../authAccess";

describe("runAuthBootstrap", () => {
  it("geeft een fout (geen toegang) als de sessieaanroep wordt verworpen", async () => {
    const loadAccess = vi.fn(async () => undefined);
    const r = await runAuthBootstrap({ getSessionUserId: () => Promise.reject(new Error("504")), loadAccess });
    expect(r).toEqual({ status: "error", message: "504" });
    expect(loadAccess).not.toHaveBeenCalled();
  });

  it("stopt na begrensde wachttijd als de sessieaanroep blijft hangen", async () => {
    const r = await runAuthBootstrap({
      getSessionUserId: () => new Promise(() => {}),
      loadAccess: async () => undefined,
      sessionTimeoutMs: 10,
    });
    expect(r.status).toBe("error");
  });

  it("stopt als het laden van rechten blijft hangen", async () => {
    const r = await runAuthBootstrap({
      getSessionUserId: async () => "u1",
      loadAccess: () => new Promise(() => {}),
      accessTimeoutMs: 10,
    });
    expect(r.status).toBe("error");
  });

  it("herstelt bij opnieuw proberen zodra de backend weer reageert", async () => {
    const getSessionUserId = vi.fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error("504"))
      .mockResolvedValue("u1");
    const opts = { getSessionUserId, loadAccess: async () => undefined };
    expect((await runAuthBootstrap(opts)).status).toBe("error");
    expect(await runAuthBootstrap(opts)).toEqual({ status: "ok", userId: "u1" });
  });

  it("withAuthTimeout geeft AuthTimeoutError", async () => {
    await expect(withAuthTimeout(new Promise(() => {}), 5, "x")).rejects.toBeInstanceOf(AuthTimeoutError);
  });
});
