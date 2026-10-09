import { describe, expect, it } from "vitest";
import { isProvenDeleted, receiptStatus } from "../../../supabase/functions/informer-sync/ledgerImport";

describe("verwijderd alleen bij bewijs", () => {
  it("404 per id = verwijderd", () => expect(isProvenDeleted(404, null)).toBe(true));
  it("400 'No records found' = verwijderd", () => expect(isProvenDeleted(400, { error: "No records found" })).toBe(true));
  it("bestaand document (200) buiten lijstvenster = niet verwijderd", () => expect(isProvenDeleted(200, { id: "1" })).toBe(false));
  it("serverfout of geen toegang = niet verwijderd", () => {
    expect(isProvenDeleted(500, "not found")).toBe(false);
    expect(isProvenDeleted(401, "not found")).toBe(false);
    expect(isProvenDeleted(0, null)).toBe(false);
  });
});

describe("bonnetjes", () => {
  it("volledig verwerkt bonnetje telt als betaald", () => expect(receiptStatus(50, 50, false)).toBe("paid"));
  it("onverwerkt zakelijk bonnetje telt niet als kosten", () => expect(receiptStatus(50, 0, false)).toBe("unprocessed"));
  it("onverwerkt DECL-bonnetje blijft open", () => expect(receiptStatus(50, 0, true)).toBe("open"));
});
