import { describe, expect, it } from "vitest";
import { exclusionReason, isActiveShop } from "./registerActive";

describe("registerActive — gedeelde telregel", () => {
  it("volgt telt_mee uit de bron wanneer die beschikbaar is", () => {
    expect(isActiveShop({ telt_mee: true, status: "gesloten" })).toBe(true);
    expect(isActiveShop({ telt_mee: false, status: "actief" })).toBe(false);
  });

  it("valt terug op de legacyregel zolang telt_mee ontbreekt", () => {
    expect(isActiveShop({ status: "actief" })).toBe(true);
    expect(isActiveShop({ status: "aangevraagd" })).toBe(true);
    expect(isActiveShop({ status: "gesloten" })).toBe(false);
    expect(isActiveShop({ status: "actief", raw: { is_ruis: true } })).toBe(false);
    expect(isActiveShop({ status: "actief", raw: { gesloten_op: "2025-01-01" } })).toBe(false);
  });

  it("vervallen dossiers tellen nooit mee, ook niet met telt_mee true", () => {
    expect(isActiveShop({ telt_mee: true, vervallen: true })).toBe(false);
  });

  it("toont de uitsluitreden van de bron", () => {
    expect(exclusionReason({ telt_mee: false, uitsluitreden: "Ruis — dubbel dossier" })).toBe(
      "Ruis — dubbel dossier",
    );
    expect(exclusionReason({ telt_mee: false })).toBe(
      "Telt niet mee volgens het landelijke register",
    );
    expect(exclusionReason({ telt_mee: true })).toBeNull();
  });

  it("telt een set dossiers volgens de bron, niet volgens de status", () => {
    const shops = [
      { telt_mee: true, status: "actief" },
      { telt_mee: true, status: "aangevraagd" },
      { telt_mee: false, status: "actief", uitsluitreden: "Nieuwe vestiging" },
      { telt_mee: false, status: "gesloten", uitsluitreden: "Gesloten" },
    ];
    expect(shops.filter(isActiveShop)).toHaveLength(2);
  });
});
