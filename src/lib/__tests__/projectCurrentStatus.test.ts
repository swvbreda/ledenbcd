import { describe, expect, it } from "vitest";
import { splitCurrentStatus } from "../projectPlan";

describe("één Huidige status-blok", () => {
  const plan = "Huidige stand\nBrief 6 okt verstuurd.\n- wacht op reactie gemeente\n\nVerloop\n2025-11-21 | Oud | a\n6 okt 2026 | Brief | b\n\nVervolg\n- Gesprek plannen";
  it("plansectie is canoniek, volledig behouden en verdwijnt uit de rest", () => {
    const r = splitCurrentStatus(plan, "Korte omschrijving");
    expect(r.status?.source).toBe("plan");
    expect(r.status?.blocks).toEqual([{ type: "paragraph", text: "Brief 6 okt verstuurd." }, { type: "list", ordered: false, items: ["wacht op reactie gemeente"] }]);
    expect(r.rest.map((s) => s.heading)).toEqual(["Verloop", "Vervolg"]);
  });
  it("zonder plansectie: omschrijving volledig als fallback, plan ongewijzigd", () => {
    const r = splitCurrentStatus("Verloop\n2026-10-06 | Brief | b", "Regel 1\nRegel 2 met <b>tekst</b>");
    expect(r.status?.blocks).toEqual([{ type: "paragraph", text: "Regel 1\nRegel 2 met <b>tekst</b>" }]);
    expect(r.rest.map((s) => s.heading)).toEqual(["Verloop"]);
  });
  it("lege kop Huidige stand valt terug op omschrijving en blijft niet dubbel", () => {
    expect(splitCurrentStatus("Huidige stand\n\nVervolg\n- x", "Omschr").status?.source).toBe("description");
  });
  it("niets ingevuld geeft geen status", () => expect(splitCurrentStatus("", " ").status).toBeNull());
});
