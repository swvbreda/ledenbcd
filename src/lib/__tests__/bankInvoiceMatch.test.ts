import { describe, expect, it } from "vitest";
import { matchBankToInvoices, type InvoiceRef } from "../bankInvoiceMatch";
import { planMemberLinks } from "../memberInvoiceLink";
import { expenseEntries, duplicateReceipts } from "../ledger";

const inv = (o: Partial<InvoiceRef> = {}): InvoiceRef => ({ doc_type: "purchase_invoice", informer_id: "1", invoice_number: "F-2026-001", amount_incl: 100, year: 2026, ...o });
const tx = (o: any = {}) => ({ id: "t1", executed_at: "2026-03-01T10:00:00Z", amount: -100, remittance_info: "betaling F-2026-001", ...o });

describe("bank -> factuur", () => {
  it("uniek nummer + exact bedrag + juiste richting = koppelen", () => {
    expect(matchBankToInvoices([tx()], [inv()], [], 2026)[0].outcome).toBe("match");
  });
  it("nummer bij twee documenten (ook al gekoppeld) = ambigu", () => {
    const r = matchBankToInvoices([tx()], [inv(), inv({ informer_id: "2" })], [{ doc_type: "purchase_invoice", informer_id: "2", ponto_transaction_id: "tx-x" }], 2026);
    expect(r[0].outcome).toBe("ambiguous_invoice");
  });
  it("factuur al gekoppeld aan andere betaling = niet koppelen", () => {
    const r = matchBankToInvoices([tx()], [inv()], [{ doc_type: "purchase_invoice", informer_id: "1", ponto_transaction_id: "other" }], 2026);
    expect(r[0].outcome).toBe("invoice_already_paid_by_other");
  });
  it("deelbetaling/split = uitzondering", () => {
    expect(matchBankToInvoices([tx({ amount: -60 })], [inv()], [], 2026)[0].outcome).toBe("split_or_partial");
  });
  it("twee factuurnummers in één betaling = uitzondering", () => {
    const r = matchBankToInvoices([tx({ remittance_info: "F-2026-001 F-2026-002" })], [inv(), inv({ informer_id: "2", invoice_number: "F-2026-002" })], [], 2026);
    expect(r[0].outcome).toBe("multi_invoice");
  });
  it("ander jaar = niet koppelen", () => {
    expect(matchBankToInvoices([tx()], [inv({ year: 2025 })], [], 2026)[0].outcome).toBe("other_year");
  });
  it("terugbetaling (bij-boeking op inkoopfactuur) = niet koppelen", () => {
    expect(matchBankToInvoices([tx({ amount: 100 })], [inv()], [], 2026)[0].outcome).toBe("refund");
  });
  it("twee betalingen voor één factuur = geen van beide", () => {
    const r = matchBankToInvoices([tx(), tx({ id: "t2" })], [inv()], [], 2026);
    expect(r.map((x) => x.outcome)).toEqual(["duplicate_payment", "duplicate_payment"]);
  });
  it("idempotent: al gekoppelde mutatie blijft 'al gekoppeld'", () => {
    const r = matchBankToInvoices([tx()], [inv()], [{ doc_type: "purchase_invoice", informer_id: "1", ponto_transaction_id: "t1" }], 2026);
    expect(r[0].outcome).toBe("linked_already");
  });
  it("nummer moet als heel kenmerk voorkomen, niet als deel", () => {
    expect(matchBankToInvoices([tx({ remittance_info: "F-2026-0012" })], [inv()], [], 2026)[0].outcome).toBe("no_reference");
  });
});

describe("contributiefactuur -> lid", () => {
  const e = { informer_id: "14269063", invoice_number: "2026-033", amount_incl: 3000, year: 2026, relation_id: "5053718" };
  const c = { id: "c1", member_id: 138, year: 2026, amount: 3000, invoice_number: "2026-033", external_invoice_id: null };
  it("relatiemap wijkt af = conflict, niet overschrijven", () => {
    const r = planMemberLinks([e], [c], [{ member_id: 138, informer_debtor_id: "5043288" }], 2026)[0];
    expect(r.outcome).toBe("conflict");
  });
  it("uniek nummer + bedrag zonder conflict = voorstel", () => {
    expect(planMemberLinks([e], [c], [], 2026)[0].outcome).toBe("propose");
  });
  it("bestaande andere koppeling blijft staan", () => {
    expect(planMemberLinks([e], [{ ...c, external_invoice_id: "999" }], [], 2026)[0].outcome).toBe("conflict");
  });
});

describe("geen dubbele kosten bon + inkoopfactuur", () => {
  const base = { amount_incl: 10, status: "open", deleted_at: null, excluded: false, counts_in_totals: true, dossier: null } as any;
  it("bonnetje met zelfde kenmerk als inkoopfactuur telt niet", () => {
    const rows = [{ ...base, id: "a", doc_type: "purchase_invoice", informer_id: "1", invoice_number: "DECL-X" }, { ...base, id: "b", doc_type: "receipt", informer_id: "1", invoice_number: "DECL-X" }];
    expect(expenseEntries(rows).map((r) => r.id)).toEqual(["a"]);
    expect(duplicateReceipts(rows).map((r) => r.id)).toEqual(["b"]);
  });
  it("onverwerkt bonnetje telt niet", () => {
    expect(expenseEntries([{ ...base, id: "c", doc_type: "receipt", informer_id: "2", status: "unprocessed" }])).toEqual([]);
  });
});
