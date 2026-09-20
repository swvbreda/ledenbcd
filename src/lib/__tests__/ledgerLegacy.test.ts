import { describe, it, expect } from "vitest";
import { matchLegacyRecords, isSyntheticPlaceholder, buildLegacyAssignments, counterpartyLineItemMap, type LegacyRecord } from "@/lib/ledgerLegacy";
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

describe("herstel van bestaande begrotingsmutaties", () => {
  it("herstelt één koppeling bij manual + pdf van dezelfde factuur en dezelfde post", () => {
    const res = matchLegacyRecords(
      [entry({})],
      [
        legacy({ key: "expense:manual" }),
        legacy({ key: "expense:pdf", dossier: null }),
      ],
    );
    const hit = res.byEntryKey.get("purchase_invoice:1");
    expect(hit?.lineItemId).toBe("li-1");
    expect(hit?.dossier).toBe("Lobby");
    expect(res.aliasesByEntryKey.get("purchase_invoice:1")?.map((r) => r.key)).toEqual([
      "expense:pdf",
    ]);
    expect(res.unmatched).toHaveLength(0);
  });

  it("koppelt niet automatisch bij conflicterende posten", () => {
    const res = matchLegacyRecords(
      [entry({})],
      [legacy({ key: "expense:a" }), legacy({ key: "expense:b", lineItemId: "li-2" })],
    );
    expect(res.byEntryKey.size).toBe(0);
    expect(res.unmatched.map((r) => r.key).sort()).toEqual(["expense:a", "expense:b"]);
  });

  it("herstelt de begrotingspost via eenduidige tegenpartijgeschiedenis", () => {
    const history = [legacy({ key: "expense:oud", invoice: "20260001", date: "2026-01-05" })];
    const e = entry({ informer_id: "9", invoice_number: "20269999" } as any);
    const match = matchLegacyRecords([e], history);
    const assign = buildLegacyAssignments([e], history, match);
    expect(assign.get("purchase_invoice:9")).toMatchObject({
      lineItemId: "li-1",
      via: "counterparty",
    });
  });

  it("wijst niets toe bij een conflicterende tegenpartijgeschiedenis", () => {
    const history = [
      legacy({ key: "expense:oud1", invoice: "20260001", date: "2026-01-05" }),
      legacy({ key: "expense:oud2", invoice: "20260002", date: "2026-02-05", lineItemId: "li-2" }),
    ];
    expect(counterpartyLineItemMap(history).size).toBe(0);
  });

  it("vult de post aan via tegenpartijhistorie als het legacy-record alleen een dossier heeft", () => {
    const e = entry({ informer_id: "7", invoice_number: "20267777" } as any);
    const records = [
      legacy({ key: "expense:dossier", invoice: "20267777", lineItemId: null, dossier: "Lobby" }),
      legacy({ key: "expense:oud", invoice: "20260001", date: "2026-01-05" }),
    ];
    const match = matchLegacyRecords([e], records);
    const assign = buildLegacyAssignments([e], records, match);
    expect(assign.get("purchase_invoice:7")).toMatchObject({
      lineItemId: "li-1",
      dossier: "Lobby",
    });
  });



  it("laat het Informer-bedrag leidend en neemt alleen post en dossier over", () => {
    const e = entry({ amount_incl: 1234.56 });
    const match = matchLegacyRecords([e], [legacy({ amount: 1000 })]);
    const assign = buildLegacyAssignments([e], [legacy({ amount: 1000 })], match);
    const buckets = bucketExpenseEntries(
      [e],
      lineItems,
      new Map([...assign].map(([k, a]) => [k, a.lineItemId])),
    );
    expect(expenseAmount(buckets.byLineItem["li-1"][0])).toBe(1234.56);
    expect(assign.get("purchase_invoice:1")?.dossier).toBe("Lobby");
  });

  it("geeft een expliciete override altijd voorrang", () => {
    const e = entry({ line_item_id: "li-2", dossier: "Overleg" } as any);
    const history = [legacy({})];
    const match = matchLegacyRecords([e], history);
    const assign = buildLegacyAssignments([e], history, match);
    const buckets = bucketExpenseEntries(
      [e],
      lineItems,
      new Map([...assign].map(([k, a]) => [k, a.lineItemId])),
    );
    expect(buckets.byLineItem["li-2"]).toHaveLength(1);
    expect(buckets.byLineItem["li-1"]).toBeUndefined();
  });

  it("houdt aliassen beschikbaar voor documenten en splits", () => {
    const res = matchLegacyRecords(
      [entry({})],
      [legacy({ key: "expense:manual" }), legacy({ key: "ponto:b", kind: "ponto", lineItemId: null, dossier: null })],
    );
    const aliases = res.aliasesByEntryKey.get("purchase_invoice:1")?.map((r) => r.key) ?? [];
    expect(aliases).toContain("ponto:b");
    expect(res.unmatched).toHaveLength(0);
  });
});

describe("documenthints en gecombineerde betalingen", () => {
  const e1 = entry({
    informer_id: "16626051",
    invoice_number: "20260688",
    amount_incl: 7158.19,
    entry_date: "2026-06-15",
    relation_name: "Bureau Brandeis B.V.",
  });
  const e2 = entry({
    informer_id: "16626058",
    invoice_number: "20260767",
    amount_incl: 125.69,
    entry_date: "2026-06-25",
    relation_name: "Bureau Brandeis B.V.",
  });
  const payment = legacy({
    key: "ponto:2fbff297",
    kind: "ponto",
    id: "2fbff297",
    invoice: null,
    externalId: null,
    counterparty: "Bureau Brandeis",
    description: "fac nrs 202506096+202506105",
    date: "2026-06-24",
    amount: 7283.88,
    lineItemId: "li-1",
    dossier: "Worldline",
  });

  it("koppelt één bankbetaling aan meerdere facturen die exact optellen", () => {
    const res = matchLegacyRecords([e1, e2], [payment]);
    expect(res.combined).toHaveLength(1);
    expect(res.combined[0].entryKeys.sort()).toEqual([
      "purchase_invoice:16626051",
      "purchase_invoice:16626058",
    ]);
    expect(res.unmatched).toHaveLength(0);
    const assign = buildLegacyAssignments([e1, e2], [payment], res);
    expect(assign.get("purchase_invoice:16626051")?.dossier).toBe("Worldline");
    expect(assign.get("purchase_invoice:16626058")?.lineItemId).toBe("li-1");
    // Bedrag blijft uit Informer; de betaling telt niet nogmaals mee.
    expect(res.combinedByEntryKey.size).toBe(2);
  });

  it("gebruikt een factuurnummer uit een document als koppelhint", () => {
    const only = entry({
      informer_id: "999",
      invoice_number: "20260688",
      amount_incl: 7158.19,
      relation_name: "Bureau Brandeis B.V.",
    });
    const rec = legacy({
      key: "ponto:x",
      kind: "ponto",
      invoice: null,
      externalId: null,
      counterparty: "Andere naam",
      date: "2026-09-01",
      amount: 12,
      lineItemId: "li-2",
      dossier: "Worldline",
    });
    const hints = new Map([["ponto:x", ["20260688"]]]);
    const res = matchLegacyRecords([only], [rec], { documentHints: hints });
    expect(res.matchedBy.get("purchase_invoice:999")).toBe("document");
    expect(res.byEntryKey.get("purchase_invoice:999")?.dossier).toBe("Worldline");
  });

  it("koppelt niet gecombineerd wanneer de som niet exact klopt", () => {
    const res = matchLegacyRecords([e1, e2], [legacy({ ...payment, amount: 7000 })]);
    expect(res.combined).toHaveLength(0);
    expect(res.unmatched).toHaveLength(1);
  });

  it("laat een echt ongekoppelde mutatie met toewijzing als lokale mutatie over", () => {
    const rec = legacy({
      key: "ponto:z",
      kind: "ponto",
      invoice: null,
      externalId: null,
      counterparty: "Onbekend B.V.",
      date: "2026-02-02",
      amount: 55,
      lineItemId: "li-2",
      dossier: "Worldline",
    });
    const res = matchLegacyRecords([e1], [rec]);
    expect(res.unmatched.map((r) => r.key)).toEqual(["ponto:z"]);
  });
});

describe("aliassen, splits en lokale mutaties", () => {
  const informer = entry({
    informer_id: "3001",
    invoice_number: "2026-0003",
    amount_incl: 630,
    entry_date: "2026-04-01",
    relation_name: "Stichting Recreational Cannabis Foundation",
  });

  it("maakt een bankregel met hetzelfde factuurnummer alias van de canonieke factuur", () => {
    const boeking = legacy({ key: "expense:a", invoice: "2026-0003", amount: 630, date: "2026-04-01", counterparty: "Stichting Recreational Cannabis Foundation" });
    const bank = legacy({
      key: "ponto:b",
      kind: "ponto",
      invoice: "Fac nr 2026-0003",
      counterparty: "Stichting RCF",
      amount: 630,
      date: "2026-04-05",
      lineItemId: null,
      dossier: "Lobby",
    });
    const res = matchLegacyRecords([informer], [boeking, bank]);
    expect(res.byEntryKey.get("purchase_invoice:3001")?.key).toBe("expense:a");
    expect(res.aliasesByEntryKey.get("purchase_invoice:3001")?.map((r) => r.key)).toContain("ponto:b");
    expect(res.unmatched).toHaveLength(0);
  });

  it("koppelt een gesplitste betaling op het dossierdeelbedrag", () => {
    const e = entry({
      informer_id: "82",
      invoice_number: "00082",
      amount_incl: 605,
      entry_date: "2026-05-01",
      relation_name: "GetSmokin",
    });
    const rec = legacy({
      key: "ponto:split",
      kind: "ponto",
      invoice: "00082",
      counterparty: "Greenmeister",
      amount: 1210,
      date: "2026-05-02",
      lineItemId: "li-1",
      dossier: null,
      splits: [
        { dossier: "Verkiezingen", amount: 605 },
        { dossier: "Overig", amount: 605 },
      ],
    });
    const res = matchLegacyRecords([e], [rec]);
    expect(res.matchedBy.get("purchase_invoice:82")).toBe("split");
    expect(res.byEntryKey.get("purchase_invoice:82")?.dossier).toBe("Verkiezingen");
    expect(res.byEntryKey.get("purchase_invoice:82")?.lineItemId).toBe("li-1");
    expect(res.unmatched).toHaveLength(0);
  });

  it("laat een echt aanvullende bankuitgave met post en dossier ongekoppeld over", () => {
    const rec = legacy({
      key: "ponto:klm",
      kind: "ponto",
      invoice: null,
      externalId: null,
      counterparty: "KLM",
      description: "Vlucht",
      amount: 289.55,
      date: "2026-07-01",
      lineItemId: "li-2",
      dossier: "Lobby",
    });
    const res = matchLegacyRecords([informer], [rec]);
    expect(res.unmatched.map((r) => r.key)).toEqual(["ponto:klm"]);
    expect(res.unmatched[0].lineItemId).toBe("li-2");
    expect(res.unmatched[0].dossier).toBe("Lobby");
  });
});
