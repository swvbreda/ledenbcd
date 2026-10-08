import { describe, expect, it } from "vitest";
import { declarationDescription, declarationTypeLabel } from "../declarationLabels";

describe("declaratielabels", () => {
  it("vaste labels per soort", () => {
    expect(declarationTypeLabel("penningmeester")).toBe("Vrijwilligersvergoeding — penningmeester");
    expect(declarationTypeLabel("woordvoering")).toBe("Vrijwilligersvergoeding — woordvoering");
    expect(declarationTypeLabel("reiskosten")).toBe("Kilometervergoeding");
    expect(declarationTypeLabel("overig")).toBe("Overige reiskosten");
  });
  it("onbekend wordt niet als overig benoemd", () => {
    expect(declarationTypeLabel("iets")).toBe("Onbekende soort (iets)");
    expect(declarationTypeLabel(null)).toBe("Onbekende soort");
  });
  it("lege maandvergoeding krijgt maand uit kostendatum (mei en juni 2026)", () => {
    expect(declarationDescription({ appointment: null, declaration_type: "penningmeester", expense_date: "2026-05-31" })).toBe("Vrijwilligersvergoeding mei 2026");
    expect(declarationDescription({ appointment: "", declaration_type: "woordvoering", expense_date: "2026-06-30" })).toBe("Vrijwilligersvergoeding juni 2026");
  });
  it("bestaande omschrijving blijft; lege overige houdt 'Geen omschrijving'", () => {
    expect(declarationDescription({ appointment: "Parkeren", declaration_type: "penningmeester", expense_date: "2026-05-31" })).toBe("Parkeren");
    expect(declarationDescription({ appointment: null, declaration_type: "overig", expense_date: "2026-05-31" })).toBe("Geen omschrijving");
  });
});
