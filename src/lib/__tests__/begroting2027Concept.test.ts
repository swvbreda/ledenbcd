import { describe, it, expect } from "vitest";
import { BEGROTING_2027, scenarioTotals, begroting2027ForCaller } from "@/lib/begroting2027Concept.server";
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

  const client = (data: unknown) => ({ rpc: async () => ({ data, error: null }) });
  it("beheerder krijgt de snapshot", async () => {
    const s = await begroting2027ForCaller(client(true), "u1");
    expect(s.totalFull).toBe(402500);
    expect(s.totalHalf).toBe(382750);
  });
  it("niet-beheerder of fout wordt geweigerd", async () => {
    await expect(begroting2027ForCaller(client(false), "u1")).rejects.toThrow("Geen rechten");
    await expect(begroting2027ForCaller({ rpc: async () => ({ data: null, error: new Error("x") }) }, "u1")).rejects.toThrow("Geen rechten");
  });
});
