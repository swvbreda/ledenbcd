import { describe, it, expect, vi } from "vitest";
import { completeContactRemoval, type ContactRemovalAdapter } from "./contactRemoval";

function adapter(): ContactRemovalAdapter {
  return { prepare: vi.fn().mockResolvedValue({ removed: true, id: "op", account_ids: ["a", "b"], accounts: 2 }), disableAndDelete: vi.fn().mockResolvedValue(undefined), finish: vi.fn().mockResolvedValue(undefined) };
}
describe("contact removal durable orchestration", () => {
  it("deletes both pinned UUIDs before confirming contact removal", async () => {
    const a = adapter(); await completeContactRemoval(a);
    expect(a.disableAndDelete).toHaveBeenNthCalledWith(1,"a"); expect(a.disableAndDelete).toHaveBeenNthCalledWith(2,"b");
    expect(a.finish).toHaveBeenCalledWith("op");
  });
  it("does not finish or report success after partial account deletion failure", async () => {
    const a = adapter(); a.disableAndDelete = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("delete failed"));
    await expect(completeContactRemoval(a)).rejects.toThrow("delete failed"); expect(a.finish).not.toHaveBeenCalled();
  });
  it("can resume with already-deleted accounts treated idempotently by adapter", async () => {
    const a = adapter(); await completeContactRemoval(a); await completeContactRemoval(a); expect(a.finish).toHaveBeenCalledTimes(2);
  });
  it("no account still finishes a verified contact-only removal", async () => {
    const a = adapter(); a.prepare = vi.fn().mockResolvedValue({ removed:true,id:"op",accounts:0,account_ids:[] });
    await completeContactRemoval(a); expect(a.disableAndDelete).not.toHaveBeenCalled(); expect(a.finish).toHaveBeenCalledWith("op");
  });
  it.each(["unbevoegd", "meerdere leden", "ambigue koppeling", "eigen account"])("blocks %s before any deletion", async (reason) => {
    const a = adapter(); a.prepare = vi.fn().mockRejectedValue(new Error(reason));
    await expect(completeContactRemoval(a)).rejects.toThrow(reason); expect(a.disableAndDelete).not.toHaveBeenCalled();
  });
  it("finish failure is not success", async () => { const a=adapter(); a.finish=vi.fn().mockRejectedValue(new Error("save failed")); await expect(completeContactRemoval(a)).rejects.toThrow("save failed"); });
});