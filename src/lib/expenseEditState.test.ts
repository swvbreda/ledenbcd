import { describe, it, expect } from "vitest";
import { ledgerSaveTransition } from "./expenseEditState";

describe("ledgerSaveTransition", () => {
  it("sluit de bewerkmodus na een geslaagde ledger-opslag", () => {
    const t = ledgerSaveTransition({ ok: true });
    expect(t.keepEditing).toBe(false);
    expect(t.reset).toBe(true);
    expect(t.saveError).toBeNull();
    expect(t.saving).toBe(false);
  });

  it("laat de bewerkmodus open bij een fout en toont de melding", () => {
    const t = ledgerSaveTransition({ ok: false, message: "Geen rij bijgewerkt" });
    expect(t.keepEditing).toBe(true);
    expect(t.reset).toBe(false);
    expect(t.saveError).toBe("Geen rij bijgewerkt");
    expect(t.saving).toBe(false);
  });

  it("valt terug op een standaardmelding zonder fouttekst", () => {
    expect(ledgerSaveTransition({ ok: false }).saveError).toBe("Opslaan mislukt");
    expect(ledgerSaveTransition({ ok: false, message: "  " }).saveError).toBe("Opslaan mislukt");
  });
});
