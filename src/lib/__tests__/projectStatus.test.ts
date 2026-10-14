import { describe, expect, it } from "vitest";
import { PROJECT_STATUS_LABEL } from "../internalWork";
describe("projectstatus", () => {
  it("te_bevestigen toont 'Te bevestigen'", () => expect(PROJECT_STATUS_LABEL.te_bevestigen).toBe("Te bevestigen"));
  it("bestaande statussen ongewijzigd", () => expect(PROJECT_STATUS_LABEL).toMatchObject({ actief: "Actief", gepauzeerd: "Gepauzeerd", afgerond: "Afgerond" }));
  it("vier keuzes in de editor", () => expect(Object.keys(PROJECT_STATUS_LABEL).sort()).toEqual(["actief", "afgerond", "gepauzeerd", "te_bevestigen"]));
});
