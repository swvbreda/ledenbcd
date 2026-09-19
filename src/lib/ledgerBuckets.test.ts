import { describe, it, expect } from "vitest";
import {
  assignLineItemId,
  bucketExpenseEntries,
  expenseAmount,
  expenseEntries,
  totalExpenses,
  type LedgerEntry,
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
  } as LedgerEntry;
}

const lineItems = [
  { id: "li-repr", name: "Representatiekosten" },
  { id: "li-reis", name: "Reiskosten" },
  { id: "li-adm", name: "Administratiekosten / accountantskosten" },
];

describe("toewijzing boekhoudregel → begrotingspost", () => {
  it("koppelt via kostenrubriek, ook met rekeningnummer ervoor", () => {
    const e = entry({ informer_id: "a", ledger_account: "4530 Representatiekosten" });
    expect(assignLineItemId(e, lineItems)).toBe("li-repr");
  });

  it("laat de expliciete override altijd voorgaan", () => {
    const e = entry({ informer_id: "a", ledger_account: "4530 Representatiekosten", line_item_id: "li-reis" });
    expect(assignLineItemId(e, lineItems)).toBe("li-reis");
  });

  it("laat onbekende rubrieken ongekoppeld", () => {
    expect(assignLineItemId(entry({ ledger_account: "4340 Advieskosten" }), lineItems)).toBeNull();
    expect(assignLineItemId(entry({ ledger_account: null }), lineItems)).toBeNull();
  });

  it("koppelt niet bij dubbele postnamen (niet eenduidig)", () => {
    const dupes = [...lineItems, { id: "li-repr-2", name: "representatiekosten" }];
    expect(assignLineItemId(entry({ ledger_account: "4530 Representatiekosten" }), dupes)).toBeNull();
  });

  it("zet een regel met line_item_id null maar geldige rubriek NIET ook in 'Niet toegewezen'", () => {
    const e = entry({ informer_id: "a", line_item_id: null, ledger_account: "5010 Reiskosten", amount_incl: 312.3 });
    const buckets = bucketExpenseEntries([e], lineItems);
    expect(buckets.byLineItem["li-reis"]).toHaveLength(1);
    expect(buckets.unassigned).toHaveLength(0);
  });

  it("verdeelt elke meetellende factuur over exact één bak", () => {
    const entries = [
      entry({ informer_id: "a", ledger_account: "4530 Representatiekosten", amount_incl: 13663.84 }),
      entry({ informer_id: "b", ledger_account: "5010 Reiskosten", amount_incl: 312.3 }),
      entry({ informer_id: "c", ledger_account: "4340 Advieskosten", amount_incl: 173240.71 }),
      entry({ informer_id: "d", ledger_account: "4390 Overige kantoorkosten", amount_incl: -217.8, status: "paid" }),
      entry({ informer_id: "e", ledger_account: null, amount_incl: 0, status: "unprocessed" }),
      entry({ informer_id: "f", doc_type: "sales_invoice", amount_incl: 2500 }),
    ];
    const buckets = bucketExpenseEntries(entries, lineItems);
    const all = [...Object.values(buckets.byLineItem).flat(), ...buckets.unassigned];
    expect(all).toHaveLength(expenseEntries(entries).length);
    expect(new Set(all.map((e) => e.informer_id)).size).toBe(all.length);
  });
});

describe("werkelijke totalen 2026 (echte productiecijfers)", () => {
  // Kostenrubrieken en bedragen zoals in de boekhouding van 2026.
  const real: Array<[string, number]> = [
    ["4340 Advieskosten", 173240.71],
    ["4001 Inhuur personeel organisatie", 55645.2],
    ["4003 Inhuur personeel uitvoering", 41708.95],
    ["4530 Representatiekosten", 13663.84],
    ["4501 Website", 2847.83],
    ["4390 Overige kantoorkosten", 2382.49],
    ["4390 Overige kantoorkosten", -217.8], // creditnota Webreact B.V.
    ["4310 Computer en ICT", 1382.69],
    ["4110 Huur bedrijfspand", 1272.0],
    ["4350 Administratiekosten", 726],
    ["5010 Reiskosten", 312.3],
    ["5000 Inkoop", 31.27],
  ];
  const entries: LedgerEntry[] = real.map(([account, amount], i) =>
    entry({ informer_id: `p${i}`, ledger_account: account, amount_incl: amount, status: "paid" }),
  );
  // Vier te verwerken documenten van €0 en één verkoopfactuur.
  entries.push(
    ...[0, 1, 2, 3].map((i) => entry({ informer_id: `u${i}`, status: "unprocessed", amount_incl: 0 })),
    entry({ informer_id: "s1", doc_type: "sales_invoice", amount_incl: 39814.42, open_amount: 2500 }),
  );

  const CANONICAL_EXPENSES = 292995.48;
  const BUDGET = 423496.0;

  it("canoniek uitgaventotaal is €292.995,48", () => {
    expect(totalExpenses(entries)).toBeCloseTo(CANONICAL_EXPENSES, 2);
  });

  it("de som van alle categoriewerkelijkheden is exact het canonieke totaal", () => {
    const buckets = bucketExpenseEntries(entries, lineItems);
    const assigned = Object.values(buckets.byLineItem)
      .flat()
      .reduce((s, e) => s + expenseAmount(e), 0);
    const unassigned = buckets.unassigned.reduce((s, e) => s + expenseAmount(e), 0);
    expect(assigned).toBeCloseTo(13976.14, 2); // Representatiekosten + Reiskosten
    expect(assigned + unassigned).toBeCloseTo(CANONICAL_EXPENSES, 2);
  });

  it("de creditnota verlaagt het totaal en wordt niet als positief geteld", () => {
    const zonderCredit = entries.filter((e) => expenseAmount(e) !== -217.8);
    expect(totalExpenses(zonderCredit) - totalExpenses(entries)).toBeCloseTo(217.8, 2);
  });

  it("beschikbaar = begroting − canonieke uitgaven", () => {
    expect(BUDGET - totalExpenses(entries)).toBeCloseTo(130500.52, 2);
  });
});
