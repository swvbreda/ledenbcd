import { describe, expect, it } from "vitest";
import { planCreditorImport, purchaseInvoiceAmount } from "../../../supabase/functions/informer-sync/creditorImport";

describe("crediteurenimport", () => {
  it("leest v2 totals.incl_vat (geneste totalen)", () => {
    expect(purchaseInvoiceAmount({ totals: { incl_vat: "1.234,56" } })).toBe(1234.56);
    expect(purchaseInvoiceAmount({ totals: { incl_vat: 210 } })).toBe(210);
  });
  it("valt terug op som van regels, ontbrekend bedrag is null en niet 0", () => {
    expect(purchaseInvoiceAmount({ lines: { a: { total_incl_vat: 10.4 }, b: { total_incl_vat: "8,15" } } })).toBe(18.55);
    expect(purchaseInvoiceAmount({ lines: [{ total_incl_vat: 1 }, {}] })).toBeNull();
    expect(purchaseInvoiceAmount({})).toBeNull();
  });
  it("maakt nooit een nieuwe regel (geen 'eerste post'), bewaart alleen bon bij bestaande", () => {
    expect(planCreditorImport("16891349", null)).toEqual({ kind: "skip", reason: "geen bestaande regel" });
    expect(planCreditorImport("", { id: "e1" })).toEqual({ kind: "skip", reason: "geen factuur-id" });
    expect(planCreditorImport("1", { id: "e1" })).toEqual({ kind: "store_document_only", expenseId: "e1" });
  });
});
