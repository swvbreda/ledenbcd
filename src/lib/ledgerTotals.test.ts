import { describe, it, expect } from "vitest";
import {
  countableEntries,
  expenseEntries,
  revenueEntries,
  needsAttention,
  openPurchaseTotal,
  openSalesTotal,
  totalExpenses,
  totalRevenue,
  ledgerReadiness,
  type LedgerEntry,
} from "./ledger";
import { deriveLastYearSync } from "@/hooks/useLedger";

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
    open_amount: 0,
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

describe("canonieke totalen", () => {
  it("telt elke meetellende inkoopfactuur exact één keer, ook zonder begrotingspost", () => {
    const entries = [
      entry({ informer_id: "a", amount_incl: 1000, line_item_id: "li-1" }),
      entry({ informer_id: "b", amount_incl: 500, line_item_id: null }),
      entry({ informer_id: "c", amount_incl: 250, ledger_account: null }),
    ];
    expect(expenseEntries(entries)).toHaveLength(3);
    expect(totalExpenses(entries)).toBe(1750);
  });

  it("negeert bankmutaties: alleen facturen komen in de totalen", () => {
    // Ponto-gegevens komen nooit als LedgerEntry binnen; een gekoppelde
    // betaling verandert het factuurbedrag niet.
    const entries = [
      entry({ informer_id: "a", amount_incl: 300, ponto_transaction_id: "tx-1", status: "paid" }),
    ];
    expect(totalExpenses(entries)).toBe(300);
  });

  it("sluit uitgesloten regels en uitgesloten dossiers uit", () => {
    const entries = [
      entry({ informer_id: "a", amount_incl: 100 }),
      entry({ informer_id: "b", amount_incl: 999, excluded: true }),
      entry({ informer_id: "c", amount_incl: 888, dossier: "Buiten begroting" }),
      entry({ informer_id: "d", amount_incl: 777, deleted_at: "2026-02-01" }),
    ];
    expect(countableEntries(entries).map((e) => e.informer_id)).toEqual(["a"]);
    expect(totalExpenses(entries)).toBe(100);
  });

  it("scheidt verkoop van inkoop en berekent openstaande bedragen", () => {
    const entries = [
      entry({ informer_id: "p1", amount_incl: 200, open_amount: 50 }),
      entry({ informer_id: "s1", doc_type: "sales_invoice", amount_incl: 300, open_amount: 120 }),
    ];
    expect(totalExpenses(entries)).toBe(200);
    expect(totalRevenue(entries)).toBe(300);
    expect(openPurchaseTotal(entries)).toBe(50);
    expect(openSalesTotal(entries)).toBe(120);
    expect(revenueEntries(entries)).toHaveLength(1);
  });

  it("markeert concepten, te verwerken documenten en €0-facturen als aandachtspunt", () => {
    const entries = [
      entry({ informer_id: "1", status: "unprocessed", amount_incl: 0 }),
      entry({ informer_id: "2", status: "draft", amount_incl: 0 }),
      entry({ informer_id: "3", status: "paid", amount_incl: 0 }),
      entry({ informer_id: "4", status: "paid", amount_incl: 150 }),
    ];
    expect(entries.filter(needsAttention)).toHaveLength(3);
    expect(totalExpenses(entries)).toBe(150);
  });

  it("markeert alleen bij exacte match als gereconcilieerd", () => {
    const entries = [entry({ informer_id: "a", amount_incl: 292995.48 })];
    const near = ledgerReadiness(entries, "2026-09-19T21:14:59Z", {
      expenses: 275797,
      revenue: 0,
    });
    expect(near.reconciled).toBe(false);
    const exact = ledgerReadiness(entries, "2026-09-19T21:14:59Z", {
      expenses: 292995.48,
      revenue: 0,
    });
    expect(exact.reconciled).toBe(true);
  });
});

describe("laatste jaarsync", () => {
  it("gebruikt de nieuwste geslaagde sync_year-log", () => {
    const log = [
      { action: "sync_year", success: false, run_at: "2026-09-20T10:00:00Z" },
      { action: "sync_year", success: true, run_at: "2026-09-19T21:14:59Z" },
      { action: "sync_payments", success: true, run_at: "2026-09-21T10:00:00Z" },
    ];
    expect(deriveLastYearSync(log, [])).toBe("2026-09-19T21:14:59Z");
  });

  it("valt terug op de hoogste last_synced_at van de regels", () => {
    expect(
      deriveLastYearSync([], [{ last_synced_at: "2026-09-19T21:14:56Z" }, { last_synced_at: null }]),
    ).toBe("2026-09-19T21:14:56Z");
  });

  it("geeft null zonder geslaagde sync en zonder regels", () => {
    expect(deriveLastYearSync([], [])).toBeNull();
  });
});
