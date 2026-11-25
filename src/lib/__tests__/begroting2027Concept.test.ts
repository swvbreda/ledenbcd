import { describe, it, expect } from "vitest";
import { BEGROTING_2027, scenarioTotals, begroting2027ForCaller } from "@/lib/begroting2027Concept.server";
import { parseFinanceSearch } from "@/lib/dossierRegister";

describe("Begroting 2027 concept", () => {
  it("volledige staffel telt op tot 404.500 en 121 groepen", () => {
    const t = scenarioTotals(BEGROTING_2027.rows);
    expect(t.full).toBe(404500);
    expect(t.groups).toBe(121);
    expect(BEGROTING_2027.totalFull).toBe(t.full);
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
    expect(s.totalFull).toBe(404500);
    expect(s).not.toHaveProperty("totalHalf");
    expect(JSON.stringify(s)).not.toMatch(/50% van de verhoging|383\.?750|28\.?650|half/i);
  });
  it("niet-beheerder of fout wordt geweigerd", async () => {
    await expect(begroting2027ForCaller(client(false), "u1")).rejects.toThrow("Geen rechten");
    await expect(begroting2027ForCaller({ rpc: async () => ({ data: null, error: new Error("x") }) }, "u1")).rejects.toThrow("Geen rechten");
  });
});

import { UITGAVEN_2027, conceptTotals } from "@/lib/begroting2027Concept.server";
describe("Uitgavenraming 2027", () => {
  const t = conceptTotals(UITGAVEN_2027, 404500);
  it("groepstotalen kloppen", () => {
    expect(Object.fromEntries(t.perCategory.map((c) => [c.name, c.total]))).toEqual({
      "Algemene kosten": 55900, "Dagelijks bestuur": 137000, Advieskosten: 213500, Donaties: 6000,
    });
  });
  it("totaal 412.400 en planresultaat -7.900 (volledige staffel)", () => {
    expect(t.expenses).toBe(412400);
    expect(t.resultFull).toBe(-7900);
  });
  it("snapshot levert uitgaven en contributie 404.500 alleen aan beheerder", async () => {
    const s = await begroting2027ForCaller({ rpc: async () => ({ data: true, error: null }) }, "u1");
    expect(conceptTotals(s.uitgaven, 404500).expenses).toBe(412400);
    expect(s.inkomsten.find((l) => l.name === "Contributies")?.budgeted).toBe(404500);
    await expect(begroting2027ForCaller({ rpc: async () => ({ data: false, error: null }) }, "u1")).rejects.toThrow();
  });
});

import { jaarsalarisInclVakantiegeld, minimaleHuur2027, WERKGEVER_WAARSCHUWING } from "../begroting2027Concept.server";
describe("2027 onderbouwing", () => {
  it("jaarsalaris 6760 p/m + 8% vakantiegeld = 87609,60", () => {
    expect(jaarsalarisInclVakantiegeld(6760)).toBe(87609.6);
    const premies = 2261.68 + 5505.62 + 412.72 + 5175.45;
    expect(premies).toBeCloseTo(13355.47, 2);
    for (const [r, v] of [[0.0274, 2261.68], [0.0667, 5505.62], [0.005, 412.72], [0.0627, 5175.45]] as const) expect(Math.round(82543 * r * 100) / 100).toBeCloseTo(v, 2);
    expect(jaarsalarisInclVakantiegeld(6760) + premies + 12 * 82).toBeCloseTo(101949.07, 2);
  });
  it("minimale huur 2027 = 5846,72 en past binnen 6000", () => {
    expect(minimaleHuur2027(484)).toBe(5846.72);
    expect(6000 - minimaleHuur2027(484)).toBeCloseTo(153.28, 2);
  });
  it("waarschuwing noemt loonbudget 102.000", () => {
    expect(WERKGEVER_WAARSCHUWING).toContain("Loonbudget €102.000");
  });
});

import { VESTIGINGEN_AANSLUITING_2027 as VA } from "../begroting2027Concept.server";
describe("Aansluiting vestigingen snapshot", () => {
  it("server-snapshot: 181 − 10 − 4 − 1 + 4 = 170, overlap −1 = 169", async () => {
    const eind = VA.stappen.reduce<number>((t, s) => t + s.delta, VA.start.aantal);
    expect(eind).toBe(170);
    expect(eind + VA.overlap.delta).toBe(169);
    const s = await begroting2027ForCaller({ rpc: async () => ({ data: true, error: null }) }, "u1");
    expect(s.aansluiting.start.aantal).toBe(181);
    expect(s.totalFull).toBe(404500);
  });
});
