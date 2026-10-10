import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { syncStateEnabled, syncStateQueryKey, SYNC_STATE_KEY } from "../syncStateScope";

describe("synclog auth-scope", () => {
  it("leest niet zolang auth/rollen nog laden", () => {
    expect(syncStateEnabled({ loading: true, userId: "u1", isAdmin: true, isBoard: false })).toBe(false);
  });
  it("leest niet zonder gebruiker of zonder admin/bestuursrol", () => {
    expect(syncStateEnabled({ loading: false, userId: null, isAdmin: false, isBoard: false })).toBe(false);
    expect(syncStateEnabled({ loading: false, userId: "u1", isAdmin: false, isBoard: false })).toBe(false);
  });
  it("leest na hydratie voor admin of bestuur", () => {
    expect(syncStateEnabled({ loading: false, userId: "u1", isAdmin: true, isBoard: false })).toBe(true);
    expect(syncStateEnabled({ loading: false, userId: "u1", isAdmin: false, isBoard: true })).toBe(true);
  });
  it("lege anonieme cache wordt niet hergebruikt na inloggen", () => {
    const qc = new QueryClient();
    qc.setQueryData(syncStateQueryKey(null), { state: null, log: [] });
    expect(qc.getQueryData(syncStateQueryKey("u1"))).toBeUndefined();
  });
  it("prefix-invalidatie raakt de gebruikersgescoped sleutel", async () => {
    const qc = new QueryClient();
    qc.setQueryData(syncStateQueryKey("u1"), { state: null, log: [] });
    await qc.invalidateQueries({ queryKey: [SYNC_STATE_KEY] });
    expect(qc.getQueryState(syncStateQueryKey("u1"))?.isInvalidated).toBe(true);
  });
});
