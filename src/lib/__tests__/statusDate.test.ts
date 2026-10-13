import { describe, expect, it } from "vitest";
import { fmtStatusDate, statusDateLabel } from "../statusDate";
describe("statusdatum", () => {
  it("PCN 2026-10-06 → Stand per 6 oktober 2026 (geen dagverschuiving)", () => expect(statusDateLabel("2026-10-06")).toBe("Stand per 6 oktober 2026"));
  it("NULL → niet vastgelegd, nooit vandaag", () => { expect(statusDateLabel(null)).toBe("Statusdatum niet vastgelegd"); expect(statusDateLabel("")).toBe("Statusdatum niet vastgelegd"); });
  it("ongeldige datum wordt niet geraden", () => { expect(fmtStatusDate("2026-02-30")).toBeNull(); expect(fmtStatusDate("6 okt")).toBeNull(); });
});
