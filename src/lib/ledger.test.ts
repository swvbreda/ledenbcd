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

describe("readiness en reconciliatie", () => {
  const goed = [
    entry({ informer_id: "p1", amount_incl: 1000, status: "paid", ledger_account: "4300 Reiskosten" }),
    entry({ informer_id: "s1", doc_type: "sales_invoice", amount_incl: 1500, status: "paid", ledger_account: "8000 Omzet" }),
  ];

  it("zonder geslaagde sync is niets gereed of gereconcilieerd", () => {
    const r = ledgerReadiness(goed, null);
    expect(r.ready).toBe(false);
    expect(r.reconciled).toBe(false);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("meetellende regels zonder bedrag blokkeren de overschakeling", () => {
    const r = ledgerReadiness(
      [...goed, entry({ informer_id: "p2", amount_incl: 0, status: "open" })],
      "2026-09-19T21:00:00Z",
    );
    expect(r.ready).toBe(false);
    expect(r.zeroAmount).toBe(1);
  });

  it("alleen exact aansluitende totalen heten gereconcilieerd", () => {
    const sync = "2026-09-19T21:00:00Z";
    expect(ledgerReadiness(goed, sync, { expenses: 1000, revenue: 1500 }).reconciled).toBe(true);
    expect(ledgerReadiness(goed, sync, { expenses: 1000.5, revenue: 1500 }).reconciled).toBe(false);
    expect(ledgerReadiness(goed, sync, { expenses: 1000 }).reconciled).toBe(false);
    expect(ledgerReadiness(goed, sync).ready).toBe(true);
  });

  it("documenten met status te verwerken blijven aandachtspunt maar tellen niet mee", () => {
    const openai = [1, 2, 3, 4].map((n) =>
      entry({ informer_id: `openai-${n}`, amount_incl: 0, status: "unprocessed" }),
    );
    const r = ledgerReadiness([...goed, ...openai], "2026-09-19T21:00:00Z");
    expect(r.attention).toBe(4);
    expect(r.ready).toBe(true);
    expect(totalExpenses([...goed, ...openai])).toBe(1000);
  });
});

describe("idempotentie en blijvende lokale toevoegingen", () => {
  it("dezelfde regels twee keer verwerken geeft identieke totalen", () => {
    const entries = [
      entry({ informer_id: "p1", amount_incl: 100, dossier: "Juridisch" }),
      entry({ informer_id: "p2", amount_incl: 200 }),
    ];
    const opnieuw = entries.map((e) => ({ ...e }));
    expect(totalExpenses(opnieuw)).toBe(totalExpenses(entries));
    expect(totalsByDossier(opnieuw)).toEqual(totalsByDossier(entries));
  });

  it("een handmatig dossier blijft na sync aan dezelfde Informer-ID hangen", () => {
    const voor = entry({ informer_id: "p1", amount_incl: 100, dossier: "Juridisch" });
    // Sync werkt alleen Informer-velden bij; dossier komt uit de override-tabel.
    const na = { ...voor, status: "paid", paid_amount: 100, open_amount: 0 } as LedgerEntry;
    expect(na.dossier).toBe("Juridisch");
    expect(totalsByDossier([na])["Juridisch"]).toBe(100);
  });

  it("uitgesloten regels tellen niet mee maar blijven zichtbaar", () => {
    const e = entry({ informer_id: "p1", amount_incl: 100, excluded: true });
    expect(countsInTotals(e)).toBe(false);
    expect(totalExpenses([e])).toBe(0);
  });
});
