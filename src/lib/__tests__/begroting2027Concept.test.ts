import { describe, it, expect } from "vitest";
import { BEGROTING_2027, scenarioTotals } from "@/lib/begroting2027Concept";
import { parseFinanceSearch } from "@/lib/dossierRegister";

describe("Begroting 2027 concept", () => {
  it("volledige staffel telt op tot 402.500 en 121 groepen", () => {
    const t = scenarioTotals(BEGROTING_2027.rows);
    expect(t.full).toBe(402500);
    expect(t.groups).toBe(121);
    expect(BEGROTING_2027.totalFull).toBe(t.full);
  });
  it("50% van de verhoging geeft 382.750", () => {
    expect(scenarioTotals(BEGROTING_2027.rows).half).toBe(382750);
    expect(BEGROTING_2027.totalHalf).toBe(382750);
  });
  it("deeplink ?tab=begroting-2027 werkt en laat het jaar ongemoeid", () => {
    const p = parseFinanceSearch(new URLSearchParams("tab=begroting-2027&year=2026"), [2026, 2025], 2026);
    expect(p.tab).toBe("begroting-2027");
    expect(p.year).toBe(2026);
    expect(parseFinanceSearch(new URLSearchParams("tab=begroting-2027"), [2026, 2025], 2025).year).toBe(2025);
  });
});
