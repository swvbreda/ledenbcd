import { describe, it, expect } from "vitest";
import { matchLegacyRecords, isSyntheticPlaceholder, type LegacyRecord } from "@/lib/ledgerLegacy";
import { documentKeysOf } from "@/hooks/useDossiers";
import { bucketExpenseEntries, expenseAmount, type LedgerEntry } from "@/lib/ledger";

const entry = (over: Partial<LedgerEntry>): LedgerEntry =>
  ({
    doc_type: "purchase_invoice",
    informer_id: "1",
    year: 2026,
    entry_date: "2026-03-01",
    amount_incl: 1000,
    open_amount: 0,
    status: "paid",
    relation_name: "Leverancier B.V.",
    invoice_number: "20260100",
    ledger_account: null,
    description: "Advies",
    counts_in_totals: true,
    line_item_id: null,
    dossier: null,
    ...over,
  }) as unknown as LedgerEntry;

const legacy = (over: Partial<LegacyRecord>): LegacyRecord => ({
  key: "expense:a",
  kind: "expense",
  id: "a",
  externalId: null,
  invoice: "20260100",
  description: "Advies",
  counterparty: "Leverancier B.V.",
  date: "2026-03-01",
  amount: 1000,
  direction: "out",
  lineItemId: "li-1",
  dossier: "Lobby",
  ...over,
});

const lineItems = [
  { id: "li-1", name: "Juridisch advies" },
  { id: "li-2", name: "Algemene kosten" },
];

describe("matchLegacyRecords", () => {
  it("koppelt via external_id en neemt post en dossier over", () => {
    const e = entry({ informer_id: "42", invoice: "" } as any);
    const res = matchLegacyRecords([e], [legacy({ externalId: "42", invoice: null })]);
    const hit = res.byEntryKey.get("purchase_invoice:42");
    expect(hit?.lineItemId).toBe("li-1");
    expect(hit?.dossier).toBe("Lobby");
    expect(res.matchedBy.get("purchase_invoice:42")).toBe("external_id");
    expect(res.unmatched).toHaveLength(0);
  });

  it("koppelt via factuurnummer wanneer er geen external_id is", () => {
    const res = matchLegacyRecords([entry({})], [legacy({})]);
    expect(res.matchedBy.get("purchase_invoice:1")).toBeDefined();
    expect(res.unmatched).toHaveLength(0);
  });

  it("koppelt elke Informer-regel en elke legacy-regel hooguit één keer", () => {
    const entries = [entry({ informer_id: "1" }), entry({ informer_id: "2" })];
    const res = matchLegacyRecords(entries, [legacy({ key: "expense:a" })]);
    const matchedKeys = [...res.byEntryKey.values()].map((r) => r.key);
    expect(matchedKeys).toHaveLength(1);
    expect(new Set(matchedKeys).size).toBe(1);
  });

  it("laat een niet te koppelen administratieve mutatie ongekoppeld", () => {
    const res = matchLegacyRecords(
      [entry({})],
      [legacy({ key: "ponto:x", kind: "ponto", invoice: "LEAP NL", counterparty: "LEAP", amount: 55, date: "2026-09-17" })],
    );
    expect(res.byEntryKey.size).toBe(0);
    expect(res.unmatched.map((r) => r.key)).toEqual(["ponto:x"]);
  });

  it("negeert synthetische Informer-hulprijen volledig", () => {
    const placeholder = legacy({
      key: "expense:placeholder",
      externalId: "42",
      invoice: null,
      description: "Informer 42",
      counterparty: "Onbekend",
      amount: 0,
      dossier: null,
      lineItemId: "li-2",
    });
    expect(isSyntheticPlaceholder(placeholder)).toBe(true);

    const e = entry({ informer_id: "42" });
    const res = matchLegacyRecords([e], [placeholder, legacy({ key: "expense:echt" })]);
    const hit = res.byEntryKey.get("purchase_invoice:42");
    // De echte factuurtoewijzing wint; de hulprij geeft geen lineItemId door.
    expect(hit?.key).toBe("expense:echt");
    expect(hit?.lineItemId).toBe("li-1");
    expect(res.unmatched.map((r) => r.key)).not.toContain("expense:placeholder");
  });

  it("houdt een gematchte legacy-sleutel beschikbaar als documentalias", () => {
    const res = matchLegacyRecords([entry({})], [legacy({ key: "expense:a" })]);
    expect(res.byEntryKey.get("purchase_invoice:1")?.key).toBe("expense:a");
    expect(documentKeysOf({ key: "ledger:purchase_invoice:1", legacyKeys: ["expense:a"] })).toContain(
      "expense:a",
    );
  });

  it("voegt een dubbele oude representatie (boeking én bank) samen als alias", () => {
    const res = matchLegacyRecords(
      [entry({})],
      [
        legacy({ key: "expense:a" }),
        legacy({ key: "ponto:b", kind: "ponto", invoice: null, lineItemId: null }),
      ],
    );
    expect(res.byEntryKey.get("purchase_invoice:1")?.key).toBe("expense:a");
    expect(res.aliasesByEntryKey.get("purchase_invoice:1")?.map((r) => r.key)).toEqual(["ponto:b"]);
    expect(res.unmatched).toHaveLength(0);
  });
});

describe("bucketExpenseEntries met bestaande toewijzing", () => {
  it("gebruikt de bestaande post, maar het Informer-bedrag wint", () => {
    const e = entry({ amount_incl: 1234.56 });
    const res = matchLegacyRecords([e], [legacy({ amount: 1000 })]);
    const map = new Map([...res.byEntryKey].map(([k, r]) => [k, r.lineItemId]));
    const buckets = bucketExpenseEntries([e], lineItems, map);
    expect(buckets.unassigned).toHaveLength(0);
    expect(buckets.byLineItem["li-1"]).toHaveLength(1);
    expect(expenseAmount(buckets.byLineItem["li-1"][0])).toBe(1234.56);
  });

  it("telt een regel nooit in twee bakken en respecteert een expliciete override", () => {
    const e = entry({ line_item_id: "li-2" } as any);
    const map = new Map([["purchase_invoice:1", "li-1"]]);
    const buckets = bucketExpenseEntries([e], lineItems, map);
    expect(buckets.byLineItem["li-2"]).toHaveLength(1);
    expect(buckets.byLineItem["li-1"]).toBeUndefined();
    expect(buckets.unassigned).toHaveLength(0);
  });

  it("zet een regel zonder match in Niet toegewezen", () => {
    const buckets = bucketExpenseEntries([entry({})], lineItems, new Map());
    expect(buckets.unassigned).toHaveLength(1);
  });
});
