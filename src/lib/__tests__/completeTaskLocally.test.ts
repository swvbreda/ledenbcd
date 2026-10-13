import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { completeTaskLocally } from "../internalWork";

function mockDb(rpcError: unknown = null) {
  const select = vi.fn().mockResolvedValue({ data: [{ id: "x" }], error: null });
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  return { rpc: vi.fn().mockResolvedValue({ error: rpcError }), from: vi.fn(() => ({ update })), update };
}

describe("completeTaskLocally", () => {
  it("Topical-taak: één keer lokale RPC, geen tabelupdate", async () => {
    const db = mockDb();
    await completeTaskLocally(db, { id: "t1", source_system: "topical" });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("topical_complete_local_only", { _task_id: "t1" });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("gewone taak: gewone update, geen RPC", async () => {
    const db = mockDb();
    await completeTaskLocally(db, { id: "t2", source_system: null });
    expect(db.update).toHaveBeenCalledWith({ status: "afgerond" });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("echte databasefout blijft zichtbaar", async () => {
    const db = mockDb(new Error("permission denied"));
    await expect(completeTaskLocally(db, { id: "t3", source_system: "topical" })).rejects.toThrow("permission denied");
  });
  it("takenlijst roept externe topicalComplete niet aan en heeft geen keuzevenster", () => {
    const src = readFileSync("src/pages/ProjectenPage.tsx", "utf8");
    expect(src).not.toMatch(/topicalComplete|Overal afronden|Opnieuw proberen/);
  });
});
