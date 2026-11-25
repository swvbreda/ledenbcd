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
  it("oude deeplink ?tab=begroting-2027 wordt dashboard + jaar 2027", () => {
    const p = parseFinanceSearch(new URLSearchParams("tab=begroting-2027&year=2026"), [2027, 2026, 2025], 2026);
    expect(p).toMatchObject({ tab: "dashboard", year: 2027, legacyConcept: true });
  });
  it("?year=2027 is geldig en 2026 blijft standaard", () => {
    expect(parseFinanceSearch(new URLSearchParams("tab=dashboard&year=2027"), [2027, 2026], 2026).year).toBe(2027);
    expect(parseFinanceSearch(new URLSearchParams(""), [2027, 2026], 2026)).toMatchObject({ tab: "dashboard", year: 2026 }); expect(parseFinanceSearch(new URLSearchParams(""), [2027, 2026], 2026).legacyConcept).toBeUndefined();
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

import { UITGAVEN_2027, conceptTotals } from "@/lib/begroting2027Concept.server";
describe("Uitgavenraming 2027", () => {
  const t = conceptTotals(UITGAVEN_2027, 402500, 382750);
  it("groepstotalen kloppen", () => {
    expect(Object.fromEntries(t.perCategory.map((c) => [c.name, c.total]))).toEqual({
      "Algemene kosten": 55900, "Dagelijks bestuur": 136000, Advieskosten: 213500, Donaties: 6000,
    });
  });
  it("totaal 411.400 en planresultaten -8.900 / -28.650", () => {
    expect(t.expenses).toBe(411400);
    expect(t.resultFull).toBe(-8900);
    expect(t.resultHalf).toBe(-28650);
  });
  it("snapshot levert uitgaven en contributie 402.500 alleen aan beheerder", async () => {
    const s = await begroting2027ForCaller({ rpc: async () => ({ data: true, error: null }) }, "u1");
    expect(conceptTotals(s.uitgaven, 402500, 382750).expenses).toBe(411400);
    expect(s.inkomsten.find((l) => l.name === "Contributies")?.budgeted).toBe(402500);
    await expect(begroting2027ForCaller({ rpc: async () => ({ data: false, error: null }) }, "u1")).rejects.toThrow();
  });
});

import { jaarsalarisInclVakantiegeld, minimaleHuur2027, WERKGEVER_WAARSCHUWING } from "../begroting2027Concept.server";
describe("2027 onderbouwing", () => {
  it("jaarsalaris 6760 p/m + 8% vakantiegeld = 87609,60", () => {
    expect(jaarsalarisInclVakantiegeld(6760)).toBe(87609.6);
    expect(jaarsalarisInclVakantiegeld(6760) + 12 * (710 + 403)).toBeCloseTo(100965.6, 2);
  });
  it("minimale huur 2027 = 5846,72 en past binnen 6000", () => {
    expect(minimaleHuur2027(484)).toBe(5846.72);
    expect(6000 - minimaleHuur2027(484)).toBeCloseTo(153.28, 2);
  });
  it("waarschuwing noemt loonbudget 101.000", () => {
    expect(WERKGEVER_WAARSCHUWING).toContain("Loonbudget €101.000");
  });
});
