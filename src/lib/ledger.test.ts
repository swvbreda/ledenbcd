import { describe, it, expect } from "vitest";
import {
  countsInTotals,
  needsAttention,
  netResult,
  openSalesTotal,
  splitsBalance,
  totalExpenses,
  totalRevenue,
  totalsByDossier,
  type LedgerEntry,
  type LedgerSplit,
} from "./ledger";

function entry(partial: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: partial.informer_id ?? "x",
    doc_type: "purchase_invoice",
    informer_id: "1",
    year: 2026,
    entry_date: "2026-01-10",
    due_date: null,
    amount_incl: 100,
    amount_excl: null,
    paid_amount: 0,
    open_amount: 100,
    status: "open",
    status_raw: null,
    relation_id: null,
    relation_name: null,
    relation_number: null,
    invoice_number: null,
    ledger_account: null,
    description: null,
    deleted_at: null,
    dossier: null,
    line_item_id: null,
    note: null,
    excluded: false,
    counts_in_totals: true,
    ponto_transaction_id: null,
    payment_date: null,
    ...partial,
  };
}

describe("ledger totalen", () => {
  it("telt alleen open en betaalde posten mee", () => {
    const entries = [
      entry({ informer_id: "1", amount_incl: 100, status: "open" }),
      entry({ informer_id: "2", amount_incl: 50, status: "paid" }),
      entry({ informer_id: "3", amount_incl: 999, status: "draft" }),
      entry({ informer_id: "4", amount_incl: 999, status: "cancelled" }),
      entry({ informer_id: "5", amount_incl: 999, status: "open", deleted_at: "2026-02-01" }),
      entry({ informer_id: "6", amount_incl: 999, status: "open", excluded: true }),
    ];
    expect(totalExpenses(entries)).toBe(150);
  });

  it("een concept van EUR 0 telt niet mee maar vraagt wel aandacht", () => {
    const openai = entry({ informer_id: "9", amount_incl: 0, status: "unprocessed" });
    expect(countsInTotals(openai)).toBe(false);
    expect(needsAttention(openai)).toBe(true);
    expect(totalExpenses([openai])).toBe(0);
  });

  it("resultaat is opbrengsten min uitgaven en open posten komen uit Informer", () => {
    const entries = [
      entry({ informer_id: "s1", doc_type: "sales_invoice", amount_incl: 3000, status: "paid", paid_amount: 3000, open_amount: 0 }),
      entry({ informer_id: "s2", doc_type: "sales_invoice", amount_incl: 3000, status: "open", open_amount: 3000 }),
      entry({ informer_id: "p1", amount_incl: 1000, status: "paid" }),
    ];
    expect(totalRevenue(entries)).toBe(6000);
    expect(totalExpenses(entries)).toBe(1000);
    expect(netResult(entries)).toBe(5000);
    expect(openSalesTotal(entries)).toBe(3000);
  });

  it("een bankmutatie verandert het uitgaventotaal niet, gekoppeld of niet", () => {
    const zonder = entry({ informer_id: "p1", amount_incl: 250, ponto_transaction_id: null });
    const met = entry({ informer_id: "p1", amount_incl: 250, ponto_transaction_id: "tx-1", payment_date: "2026-03-01" });
    expect(totalExpenses([zonder])).toBe(totalExpenses([met]));
  });

  it("dossiertotalen tellen elke post exact eenmaal", () => {
    const entries = [
      entry({ informer_id: "p1", amount_incl: 100, dossier: "Juridisch" }),
      entry({ informer_id: "p2", amount_incl: 200, dossier: "Juridisch" }),
      entry({ informer_id: "p3", amount_incl: 50 }),
    ];
    const totals = totalsByDossier(entries);
    expect(totals["Juridisch"]).toBe(300);
    expect(totals["Niet toegewezen"]).toBe(50);
    expect(Object.values(totals).reduce((a, b) => a + b, 0)).toBe(totalExpenses(entries));
  });

  it("splits vervangen de regel en sommeren tot het factuurbedrag", () => {
    const e = entry({ informer_id: "p1", amount_incl: 300, dossier: "Juridisch" });
    const splits: LedgerSplit[] = [
      { informer_id: "p1", doc_type: "purchase_invoice", dossier: "Juridisch", amount: 200 },
      { informer_id: "p1", doc_type: "purchase_invoice", dossier: "Lobby", amount: 100 },
    ];
    const totals = totalsByDossier([e], splits);
    expect(totals["Juridisch"]).toBe(200);
    expect(totals["Lobby"]).toBe(100);
    expect(Object.values(totals).reduce((a, b) => a + b, 0)).toBe(300);
    expect(splitsBalance(e, splits)).toBe(true);
    expect(splitsBalance(e, [{ ...splits[0], amount: 150 }])).toBe(false);
  });
});
