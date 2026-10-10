import { describe, it, expect } from "vitest";
import { containsRef, maskBankMetadata } from "../bankInvoiceMatch";

const pos = "BEA, Apple Pay PDX Catering,PAS045 NR:C487Z9,21.09.26/13:25 AMSTELVEEN";
describe("bankmetadata vóór kenmerkmatching", () => {
  it("POS datum/tijd is geen factuur 2613", () => {
    expect(containsRef(pos, "2613")).toBe(false);
    expect(containsRef("BEA NR:X1 21.09.2026/13:25 AMSTELVEEN", "2613")).toBe(false);
    expect(containsRef("BEA 21.09.2026 13:25", "2613")).toBe(false);
  });
  it("echte factuur 2613 in omschrijving blijft matchen", () => {
    expect(containsRef("Omschrijving: factuur 2613 Psychotropica", "2613")).toBe(true);
  });
  it("PAS/NR-codes worden niet als kenmerk gezien", () => {
    expect(containsRef(pos, "C487Z9")).toBe(false);
    expect(containsRef(pos, "PAS045")).toBe(false);
  });
  it("kenmerk ingebed in IBAN matcht niet", () => {
    expect(containsRef("NL91ABNA0417164300 betaling", "4171")).toBe(false);
    expect(maskBankMetadata("IBAN NL91ABNA0417164300")).not.toContain("0417164300");
  });
  it("gescheiden 2026071: volledige alias wel, kort 202607 niet", () => {
    const t = "Omschrijving: Factuur nr:202607 1 coffeeshop the corner";
    expect(containsRef(t, "2026071")).toBe(true);
    expect(containsRef(t, "202607")).toBe(false);
  });
  it("factuur met letters 2026/023AB en 2026023/Othala blijven goed", () => {
    expect(containsRef("Betaling 2026/023AB", "2026023AB")).toBe(true);
    expect(containsRef("2026023/Othala BV", "2026023")).toBe(true);
    expect(containsRef("Contributie 202 6002", "2026002")).toBe(true);
  });
});
describe("los fragment vs volwaardig nummer", () => {
  it("twee losse volwaardige nummers blijven elk vindbaar", () => {
    expect(containsRef("F-023 2026023", "2026023")).toBe(true);
    expect(containsRef("F-023 2026023", "F023")).toBe(true);
  });

  it("kort nummer als achterdeel van gesplitst nummer matcht niet", () => {
    expect(containsRef("Contributie 202 6002", "6002")).toBe(false);
    expect(containsRef("202 6002", "6002")).toBe(false);
    expect(containsRef("202 6002", "2026002")).toBe(true);
    expect(containsRef("Betaling 2026/023AB", "2026023AB")).toBe(true);
  });
});
