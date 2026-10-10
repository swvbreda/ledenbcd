import { describe, it, expect } from "vitest";
import { loadSyncState } from "../syncStateScope";

const never = () => new Promise<any>(() => {});
const ok = (data: any) => () => Promise.resolve({ data, error: null });
const yearRow = { id: "y1", action: "sync_year", success: true, run_at: "2026-10-10T21:36:12Z", items_processed: 161, details: { year: 2026 } };
const base = { getSessionUserId: () => Promise.resolve("u1"), state: ok({ id: 1 }), recent: ok([]), year: ok([yearRow]) };

describe("loadSyncState", () => {
  it("vastlopende getSession eindigt in fout", async () => {
    await expect(loadSyncState({ ...base, getSessionUserId: never }, "u1", 20)).rejects.toThrow(/Sessiecontrole/);
  });
  it("hangende statequery maskeert jaarsynclog niet", async () => {
    const r = await loadSyncState({ ...base, state: never }, "u1", 20);
    expect(r.log[0].items_processed).toBe(161);
    expect(r.state).toBeNull();
    expect(r.stateError).toMatch(/Synchronisatiestatus/);
  });
  it("fout in recente log houdt jaarlog zichtbaar", async () => {
    const r = await loadSyncState({ ...base, recent: () => Promise.resolve({ data: null, error: { message: "timeout" } }) }, "u1", 20);
    expect(r.log).toHaveLength(1);
    expect(r.recentError).toMatch(/timeout/);
  });
  it("fout in jaarlog wordt echte fout, geen lege log", async () => {
    await expect(
      loadSyncState({ ...base, year: () => Promise.resolve({ data: null, error: { message: "permission denied" } }) }, "u1", 20),
    ).rejects.toThrow(/Jaarsynclog: permission denied/);
  });
  it("andere sessiegebruiker leest niets", async () => {
    let read = false;
    await expect(loadSyncState({ ...base, getSessionUserId: () => Promise.resolve("u2"), year: () => { read = true; return Promise.resolve({ data: [], error: null }); } }, "u1", 20)).rejects.toThrow();
    expect(read).toBe(false);
  });
});
