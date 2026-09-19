// Behoud van de bestaande administratieve indeling bij canonieke Informer-regels.
//
// Informer (ledger_entries_v) blijft de enige bron voor bedragen, facturen en
// betaalstatus. De historische administratie (budget_expenses en
// ponto_transactions) levert uitsluitend de toewijzing: begrotingspost,
// dossier, splits en documentkoppeling. Deze module is puur, zodat begroting,
// dossiers en controle exact dezelfde koppeling gebruiken.

import { isSamePayment, sharesInvoiceNumber } from "@/lib/ledgerDedupe";
import type { LedgerEntry } from "@/lib/ledger";

export type LegacyKind = "expense" | "ponto";

export interface LegacyRecord {
  /** Stabiele sleutel, ook gebruikt voor documenten en splits: "expense:uuid". */
  key: string;
  kind: LegacyKind;
  id: string;
  /** Eventuele directe verwijzing naar de Informer-regel. */
  externalId: string | null;
  invoice: string | null;
  description: string | null;
  counterparty: string | null;
  date: string | null;
  amount: number;
  direction: "in" | "out";
  lineItemId: string | null;
  dossier: string | null;
  /**
   * Technische hulprij uit een oude synchronisatie (bedrag 0, omschrijving
   * "Informer <id>", geen tegenpartij/dossier). Geen door de leden
   * goedgekeurde toewijzing en dus onbruikbaar voor post- en dossiermatching.
   */
  placeholder?: boolean;
}

/** Herkent synthetische Informer-hulprijen uit oude synchronisaties. */
export function isSyntheticPlaceholder(r: {
  amount: number;
  description: string | null;
  counterparty: string | null;
  invoice: string | null;
  dossier: string | null;
}): boolean {
  const description = (r.description || "").trim();
  return (
    Math.abs(r.amount) < 0.005 &&
    /^Informer\s+\d+$/i.test(description) &&
    !r.invoice &&
    !r.dossier &&
    (!r.counterparty || r.counterparty.trim().toLowerCase() === "onbekend")
  );
}

export interface LegacyMatchResult {
  /** Informer-regelsleutel ("purchase_invoice:123") → bestaande administratie. */
  byEntryKey: Map<string, LegacyRecord>;
  /**
   * Extra administratieve representaties van dezelfde betaling (bv. zowel een
   * budget_expense als een Ponto-mutatie). Alleen voor documentkoppeling.
   */
  aliasesByEntryKey: Map<string, LegacyRecord[]>;
  /** Administratieve regels die (nog) niet aan een Informer-regel hangen. */
  unmatched: LegacyRecord[];
  matchedBy: Map<string, "external_id" | "invoice" | "payment">;
}

export function ledgerKeyOf(entry: Pick<LedgerEntry, "doc_type" | "informer_id">): string {
  return `${entry.doc_type}:${entry.informer_id}`;
}

const asLedgerLike = (e: LedgerEntry) => ({
  date: e.entry_date,
  amount: Number(e.amount_incl) || 0,
  counterparty: e.relation_name,
  description: e.description,
  invoice: e.invoice_number,
  direction: e.doc_type === "sales_invoice" ? "in" : "out",
});

const asRecordLike = (r: LegacyRecord) => ({
  date: r.date,
  amount: r.amount,
  counterparty: r.counterparty,
  description: r.description,
  invoice: r.invoice,
  direction: r.direction,
});

/**
 * Conservatieve koppeling: eerst external_id/informer_id, dan factuurnummer,
 * dan bedrag + tegenpartij + datum. Elke Informer-regel en elke administratieve
 * regel wordt hooguit één keer gekoppeld, zodat niets dubbel kan tellen.
 */
export function matchLegacyRecords(
  entries: LedgerEntry[],
  legacy: LegacyRecord[],
): LegacyMatchResult {
  const byEntryKey = new Map<string, LegacyRecord>();
  const aliasesByEntryKey = new Map<string, LegacyRecord[]>();
  const matchedBy = new Map<string, "external_id" | "invoice" | "payment">();
  const usedLegacy = new Set<string>();

  // Synthetische hulprijen doen niet mee aan matching: ze bevatten geen
  // goedgekeurde toewijzing en zouden echte facturen verkeerd koppelen.
  const usable = legacy.filter((r) => !r.placeholder && !isSyntheticPlaceholder(r));

  const take = (
    entry: LedgerEntry,
    record: LegacyRecord,
    how: "external_id" | "invoice" | "payment",
  ) => {
    const key = ledgerKeyOf(entry);
    byEntryKey.set(key, record);
    matchedBy.set(key, how);
    usedLegacy.add(record.key);
  };

  const available = () => usable.filter((r) => !usedLegacy.has(r.key));

  // 1. Directe verwijzing.
  for (const entry of entries) {
    if (byEntryKey.has(ledgerKeyOf(entry))) continue;
    const key = ledgerKeyOf(entry);
    const hit = available().find(
      (r) =>
        !!r.externalId &&
        (r.externalId === entry.informer_id || r.externalId === key),
    );
    if (hit) take(entry, hit, "external_id");
  }

  // 2. Factuurnummer.
  for (const entry of entries) {
    if (byEntryKey.has(ledgerKeyOf(entry))) continue;
    const self = asLedgerLike(entry);
    const hits = available().filter((r) => sharesInvoiceNumber(self, asRecordLike(r)));
    // Alleen een eenduidige factuurmatch telt.
    if (hits.length === 1) take(entry, hits[0], "invoice");
  }

  // 3. Bedrag + tegenpartij + datum.
  for (const entry of entries) {
    if (byEntryKey.has(ledgerKeyOf(entry))) continue;
    const self = asLedgerLike(entry);
    const hits = available().filter((r) => isSamePayment(self, asRecordLike(r)));
    if (hits.length === 1) take(entry, hits[0], "payment");
  }

  // 4. Dezelfde oude betaling die zowel als boeking als bankmutatie bestaat:
  // die hangt als alias aan de Informer-regel (alleen voor documenten) en
  // verschijnt dus niet apart als "nog niet gekoppeld".
  for (const [key, record] of byEntryKey) {
    const extra = available().filter(
      (r) =>
        r.key !== record.key &&
        (isSamePayment(asRecordLike(record), asRecordLike(r)) ||
          sharesInvoiceNumber(asRecordLike(record), asRecordLike(r))),
    );
    for (const r of extra) usedLegacy.add(r.key);
    if (extra.length > 0) aliasesByEntryKey.set(key, extra);
  }

  return {
    byEntryKey,
    aliasesByEntryKey,
    matchedBy,
    // Synthetische hulprijen zijn geen administratief aandachtspunt.
    unmatched: usable.filter((r) => !usedLegacy.has(r.key)),
  };
}
