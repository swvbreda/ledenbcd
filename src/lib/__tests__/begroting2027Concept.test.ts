import { describe, it, expect } from "vitest";
import { BEGROTING_2027, scenarioTotals, begroting2027ForCaller } from "@/lib/begroting2027Concept.server";
import { parseFinanceSearch } from "@/lib/dossierRegister";

describe("Begroting 2027 concept", () => {
  it("volledige staffel telt op tot 407.500 en 122 groepen", () => {
    const t = scenarioTotals(BEGROTING_2027.rows);
    expect(t.full).toBe(407500);
    expect(t.groups).toBe(122);
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
    expect(s.totalFull).toBe(407500);
    expect(s).not.toHaveProperty("totalHalf");
    expect(JSON.stringify(s)).not.toMatch(/50% van de verhoging|383\.?750|28\.?650|half/i);
  });
  it("niet-beheerder of fout wordt geweigerd", async () => {
    await expect(begroting2027ForCaller(client(false), "u1")).rejects.toThrow("Geen rechten");
    await expect(begroting2027ForCaller({ rpc: async () => ({ data: null, error: new Error("x") }) }, "u1")).rejects.toThrow("Geen rechten");
  });
});

import { UITGAVEN_2027, conceptTotals, RESERVE_2027, PERSONEELSKOSTEN_2027 } from "@/lib/begroting2027Concept.server";
describe("Uitgavenraming 2027", () => {
  const t = conceptTotals(UITGAVEN_2027, 407500);
  it("groepstotalen kloppen", () => {
    expect(Object.fromEntries(t.perCategory.map((c) => [c.name, c.total]))).toEqual({
      "Algemene kosten": 54400, "Dagelijks bestuur": 182000, Advieskosten: 148500, Donaties: 6000, "Onvoorziene uitgaven": 1600,
    });
  });
  it("totaal 392.500 en planresultaat +15.000 (volledige staffel)", () => {
    expect(t.expenses).toBe(392500);
    expect(t.resultFull).toBe(15000);
  });
  it("goedgekeurde posten: secretariaat 15.000, onderzoek 20.000, juridisch 100.000, ondersteunend medewerker 45.000, marketing/merchandise 25.000, kantoor 9.000, Voorzitter 107.000, onvoorzien 1.600", () => {
    const line = (n: string) => UITGAVEN_2027.flatMap((c) => c.lines).find((l) => l.name === n)?.budgeted;
    expect(line("Secretariaatskosten")).toBe(15000);
    expect(line("Onderzoek")).toBe(20000);
    expect(line("Juridische kosten / bestuurlijk advies")).toBe(100000);
    expect(line("Personeelskosten – Ondersteunend medewerker")).toBe(45000);
    expect(line("Communicatie / marketing / merchandise")).toBe(25000);
    expect(line("Kantoorkosten")).toBe(9000);
    expect(line("Jaarlijkse onvoorziene uitgaven")).toBe(1600);
    expect(line("Personeelskosten – Voorzitter")).toBe(107000);
    expect(PERSONEELSKOSTEN_2027.voorzitter.loon).toBe(102000);
    expect(PERSONEELSKOSTEN_2027.voorzitter.aanvullend).toBe(5000);
    const all = UITGAVEN_2027.flatMap((c) => c.lines);
    expect(all.filter((l) => /Voorzitter|personeel/i.test(l.name)).map((l) => l.name)).toEqual(["Personeelskosten – Voorzitter", "Personeelskosten – Ondersteunend medewerker"]);
    expect(all.some((l) => l.budgeted === 120000)).toBe(false);
    expect(JSON.stringify(all)).not.toMatch(/Strategiebureau/);
    expect(line("Ondersteuning")).toBe(10000);
    expect(line("Onkosten vergoedingen")).toBe(5000);
  });
  it("reserve los van kosten: 115.000 voorlopig + 15.000 = 130.000, geen kostenpost", () => {
    expect(RESERVE_2027.beginVoorlopig).toBe(true);
    expect(RESERVE_2027.begin + t.resultFull).toBe(RESERVE_2027.eind);
    expect(RESERVE_2027.eind).toBe(130000);
    expect(UITGAVEN_2027.flatMap((c) => c.lines).some((l) => /reserve/i.test(l.name))).toBe(false);
  });
  it("snapshot levert uitgaven en contributie 407.500 alleen aan beheerder", async () => {
    const s = await begroting2027ForCaller({ rpc: async () => ({ data: true, error: null }) }, "u1");
    expect(conceptTotals(s.uitgaven, 407500).expenses).toBe(392500);
    expect(s.reserve).toEqual({ begin: 115000, beginVoorlopig: true, toevoeging: 15000, eind: 130000 });
    expect(s.inkomsten.find((l) => l.name === "Contributies")?.budgeted).toBe(407500);
    expect(s.inkomsten.reduce((a, l) => a + l.budgeted, 0)).toBe(407500);
    await expect(begroting2027ForCaller({ rpc: async () => ({ data: false, error: null }) }, "u1")).rejects.toThrow();
  });
});

import { jaarsalarisInclVakantiegeld, minimaleHuur2027, WERKGEVER_WAARSCHUWING_INTERN } from "../begroting2027Concept.server";
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
  it("interne waarschuwing noemt loonbudget 102.000; zichtbare tekst splitst niet en noemt geen Strategiebureau", async () => {
    expect(WERKGEVER_WAARSCHUWING_INTERN).toContain("Loonbudget €102.000");
    const snap = JSON.stringify(await begroting2027ForCaller({ rpc: async () => ({ data: true, error: null }) }, "u1"));
    expect(snap).not.toMatch(/Strategiebureau|vakantiegeld|Zvw|102\.000/);
  });
});

import { VESTIGINGEN_AANSLUITING_2027 as VA, LEDENREGISTRATIE_2027 } from "../begroting2027Concept.server";
const s0 = () => ({ ledenRegistratie: LEDENREGISTRATIE_2027 });
describe("Aansluiting vestigingen snapshot", () => {
  it("server-snapshot: 180 − 10 − 2 − 1 + 4 + 1 − 1 = 171", async () => {
    const eind = VA.stappen.reduce<number>((t, s) => t + s.delta, VA.start.aantal);
    expect(eind).toBe(171);
    expect(s0().ledenRegistratie.geregistreerd - s0().ledenRegistratie.uitgesloten.length).toBe(122);
    const s = await begroting2027ForCaller({ rpc: async () => ({ data: true, error: null }) }, "u1");
    expect(s.aansluiting.start.aantal).toBe(180);
    expect(s.totalFull).toBe(407500);
    expect(s.groups.find((g) => g.id === 144)?.shops).toBe(2);
    expect(s.groups.some((g) => g.id === 150 || g.id === 32)).toBe(false);
    expect(JSON.stringify(s.ledenRegistratie)).not.toContain("Scolo");
    expect(s.ledenRegistratie.geregistreerd).toBe(124);
    expect(s.ledenRegistratie.uitgesloten.map((u) => u.id)).toEqual([125, 51]);
    expect(s.leden.some((g) => g.id === 140)).toBe(false);
    expect(JSON.stringify(s.ledenRegistratie)).not.toContain("Tyson");
    expect(s.controlepunten.join(" ")).not.toContain("Tyson");
  });
});
