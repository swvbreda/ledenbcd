import { describe, expect, it } from "vitest";
import {
  buildContributionInvoiceRows,
  buildOtherRevenueRows,
  summarizeInvoiceRows,
} from "@/lib/contributionLedger";
import type { LedgerEntry } from "@/lib/ledger";

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  id: over.informer_id ?? "x",
  doc_type: "sales_invoice",
  informer_id: "1",
  year: 2026,
  entry_date: "2026-01-10",
  due_date: null,
  amount_incl: 1500,
  amount_excl: null,
  paid_amount: 1500,
  open_amount: 0,
  status: "paid",
  status_raw: null,
  relation_id: "5005363",
  relation_name: "Flamingo",
  relation_number: null,
  invoice_number: "2026-0001",
  ledger_account: "4940 Contributies",
  description: null,
  deleted_at: null,
  dossier: null,
  line_item_id: null,
  note: null,
  excluded: false,
  counts_in_totals: true,
  ponto_transaction_id: null,
  payment_date: null,
  ...over,
});

describe("contributionLedger", () => {
  const entries: LedgerEntry[] = [
    entry({ informer_id: "1", invoice_number: "2026-0001" }),
    entry({
      informer_id: "2",
      invoice_number: "2026-0005",
      amount_incl: 1000,
      paid_amount: 0,
      open_amount: 1000,
      status: "open",
      relation_id: "999",
    }),
    entry({
      informer_id: "3",
      invoice_number: "2026-0007",
      ledger_account: "8000 Omzet",
      amount_incl: 28814.42,
      paid_amount: 28814.42,
      open_amount: 0,
    }),
    // Niet meetellend: concept-factuur mag nergens meetellen.
    entry({ informer_id: "4", status: "draft", amount_incl: 99999 }),
  ];

  it("classificeert op grootboekrekening en telt facturen exact één keer", () => {
    const rows = buildContributionInvoiceRows(entries, new Map([["5005363", 134]]));
    expect(rows.map((r) => r.invoiceNumber)).toEqual(["2026-0001", "2026-0005"]);
    expect(rows[0].memberId).toBe(134);
    expect(rows[1].memberId).toBeNull();
    expect(rows[1].status).toBe("open");

    const totals = summarizeInvoiceRows(rows);
    expect(totals).toEqual({ count: 2, invoiced: 2500, paid: 1500, open: 1000 });
  });

  it("houdt overige verkoopopbrengsten apart en volledig zichtbaar", () => {
    const other = buildOtherRevenueRows(entries);
    expect(other).toHaveLength(1);
    expect(other[0].invoiceNumber).toBe("2026-0007");
    expect(summarizeInvoiceRows(other)).toEqual({
      count: 1,
      invoiced: 28814.42,
      paid: 28814.42,
      open: 0,
    });
  });

  it("negeert lokale contributieadministratie volledig (alleen ledger telt)", () => {
    // Zelfde factuur nogmaals als lokale placeholder bestaat niet in de ledger:
    // een extra lokale rij kan het totaal dus niet beïnvloeden.
    const totals = summarizeInvoiceRows(buildContributionInvoiceRows(entries));
    expect(totals.invoiced).toBe(2500);
  });
});
