import { describe, expect, it } from "vitest";
import { splitCurrentStatus } from "../projectPlan";

describe("één Huidige status-blok", () => {
  const plan = "Huidige stand\nBrief 6 okt verstuurd.\n- wacht op reactie gemeente\n\nVerloop\n2025-11-21 | Oud | a\n6 okt 2026 | Brief | b\n\nVervolg\n- Gesprek plannen";
  it("bewerkte omschrijving is altijd de getoonde status", () => {
    const r = splitCurrentStatus(plan, "Nieuwe stand door gebruiker");
    expect(r.status).toEqual({ source: "description", blocks: [{ type: "paragraph", text: "Nieuwe stand door gebruiker" }] });
  });
  it("lege omschrijving: plansectie Huidige stand volledig als fallback", () => {
    const r = splitCurrentStatus(plan, "  ");
    expect(r.status?.source).toBe("plan");
    expect(r.status?.blocks).toEqual([{ type: "paragraph", text: "Brief 6 okt verstuurd." }, { type: "list", ordered: false, items: ["wacht op reactie gemeente"] }]);
  });
  it("Huidige stand nooit als tweede statuskop in de overige secties", () => {
    for (const d of ["Omschr", ""]) expect(splitCurrentStatus(plan, d).rest.map((s) => s.heading)).toEqual(["Verloop", "Vervolg"]);
  });
  it("niets ingevuld geeft geen status", () => expect(splitCurrentStatus("", " ").status).toBeNull());
});
