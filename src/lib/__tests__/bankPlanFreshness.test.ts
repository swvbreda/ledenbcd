import { describe, expect, it } from "vitest";
import { matchBankToInvoices, writableBankLinks, type InvoiceRef } from "../bankInvoiceMatch";

const inv = (o: Partial<InvoiceRef> = {}): InvoiceRef => ({ doc_type: "purchase_invoice", informer_id: "1", invoice_number: "F-2026-001", amount_incl: 100, year: 2026, ...o });
const tx = { id: "t1", executed_at: "2026-03-01T10:00:00Z", amount: -100, remittance_info: "F-2026-001" };

describe("koppelplan altijd vers na sync", () => {
  const oud = writableBankLinks(matchBankToInvoices([tx], [inv()], [], 2026));
  it("oud plan had een koppeling", () => expect(oud).toHaveLength(1));
  it("factuurbedrag gewijzigd na sync: vers plan schrijft niets", () => {
    expect(writableBankLinks(matchBankToInvoices([tx], [inv({ amount_incl: 120 })], [], 2026))).toEqual([]);
  });
  it("factuur verwijderd na sync: vers plan schrijft niets", () => {
    expect(writableBankLinks(matchBankToInvoices([tx], [inv({ deleted_at: "2026-10-09" })], [], 2026))).toEqual([]);
  });
  it("factuur naar ander jaar na sync: vers plan schrijft niets", () => {
    expect(writableBankLinks(matchBankToInvoices([tx], [inv({ year: 2025 })], [], 2026))).toEqual([]);
  });
  it("bankmutatie intussen handmatig gekoppeld: niets schrijven", () => {
    expect(writableBankLinks(matchBankToInvoices([tx], [inv()], [{ doc_type: "purchase_invoice", informer_id: "9", ponto_transaction_id: "t1" }], 2026))).toEqual([]);
  });
  it("factuur intussen aan andere betaling gekoppeld: niets schrijven", () => {
    expect(writableBankLinks(matchBankToInvoices([tx], [inv()], [{ doc_type: "purchase_invoice", informer_id: "1", ponto_transaction_id: "t9" }], 2026))).toEqual([]);
  });
  it("tweede document met zelfde nummer verschenen: ambigu, niets schrijven", () => {
    expect(writableBankLinks(matchBankToInvoices([tx], [inv(), inv({ informer_id: "2" })], [], 2026))).toEqual([]);
  });
  it("creditfactuur en terugbetaling niet als gewone betaling", () => {
    expect(matchBankToInvoices([{ ...tx, amount: 100 }], [inv({ amount_incl: -100 })], [], 2026)[0].outcome).toBe("refund");
    expect(matchBankToInvoices([{ ...tx, amount: -100 }], [inv({ amount_incl: -100 })], [], 2026)[0].outcome).toBe("refund");
  });
});
