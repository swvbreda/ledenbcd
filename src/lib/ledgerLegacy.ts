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

export type MatchMethod = "external_id" | "invoice" | "document" | "payment" | "combined";

export interface CombinedPayment {
  /** De lokale betaling (meestal een bankmutatie) die meerdere facturen dekt. */
  legacyKey: string;
  /** Informer-regelsleutels die samen exact deze betaling vormen. */
  entryKeys: string[];
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
  matchedBy: Map<string, MatchMethod>;
  /** Eén betaling die exact meerdere Informer-facturen dekt. */
  combined: CombinedPayment[];
  /** Informer-regelsleutel → de gecombineerde betaling waar hij in zit. */
  combinedByEntryKey: Map<string, LegacyRecord>;
}

/** Factuurnummers die uit documenten bij een lokale mutatie bekend zijn. */
export type DocumentHints = Map<string, string[]>;

export interface MatchOptions {
  /** legacy key ("ponto:uuid") → factuurnummers uit expense_documents. */
  documentHints?: DocumentHints;
}

/** Genormaliseerde tegenpartijsleutel voor de conservatieve postfallback. */
export function normalizeCounterparty(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(b\.?\s?v\.?|n\.?\s?v\.?|v\.?o\.?f\.?|vof|holding|group|nederland)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Meerdere oude representaties van dezelfde factuur (bv. een handmatige boeking
 * én een pdf-import) mogen samen één koppeling vormen, mits ze niet
 * tegenstrijdig zijn: alle ingevulde begrotingsposten gelijk en alle ingevulde
 * dossiers gelijk.
 */
export function groupIsConsistent(records: LegacyRecord[]): boolean {
  const posts = new Set(records.map((r) => r.lineItemId).filter((v): v is string => !!v));
  const dossiers = new Set(
    records.map((r) => (r.dossier || "").trim()).filter((v) => v.length > 0),
  );
  return posts.size <= 1 && dossiers.size <= 1;
}

/** Kiest de meest informatieve representatie als primaire koppeling. */
function pickPrimary(records: LegacyRecord[]): LegacyRecord {
  const score = (r: LegacyRecord) =>
    (r.lineItemId ? 4 : 0) + (r.dossier ? 2 : 0) + (r.kind === "expense" ? 1 : 0);
  return [...records].sort((a, b) => score(b) - score(a) || a.key.localeCompare(b.key))[0];
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

/** Factuursleutels uit de documenten die bij een lokale mutatie horen. */
function hintKeysFor(record: LegacyRecord, hints?: DocumentHints): string[] {
  const raw = hints?.get(record.key) ?? [];
  return [
    ...new Set(
      raw.flatMap((value) => invoiceKeysOf({ date: null, amount: 0, invoice: value })),
    ),
  ];
}

const entryInvoiceKeys = (e: LedgerEntry) => invoiceKeysOf(asLedgerLike(e));

const cents = (value: number) => Math.round(Math.abs(value) * 100);

const daysBetween = (a: string | null, b: string | null) => {
  const ta = a ? new Date(a).getTime() : NaN;
  const tb = b ? new Date(b).getTime() : NaN;
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.round((ta - tb) / 86_400_000);
};

/**
 * Zoekt de unieke combinatie van Informer-facturen die exact één lokale
 * betaling vormt. Voorwaarden: zelfde leverancier, som exact op centen,
 * plausibele datums en precies één mogelijke combinatie. Documenthints krijgen
 * voorrang: combinaties die de bekende factuur bevatten gaan voor.
 */
export function findCombination(
  record: LegacyRecord,
  candidates: LedgerEntry[],
  hintKeys: string[] = [],
): LedgerEntry[] | null {
  const target = cents(record.amount);
  if (target === 0) return null;
  const pool = candidates.slice(0, 12);
  const solutions: LedgerEntry[][] = [];
  const search = (index: number, picked: LedgerEntry[], sum: number) => {
    if (solutions.length > 8) return;
    if (picked.length >= 2 && sum === target) {
      solutions.push([...picked]);
      return;
    }
    if (index >= pool.length || picked.length >= 4 || sum > target) return;
    search(index + 1, [...picked, pool[index]], sum + cents(Number(pool[index].amount_incl) || 0));
    search(index + 1, picked, sum);
  };
  search(0, [], 0);
  if (solutions.length === 0) return null;
  if (hintKeys.length > 0) {
    const withHint = solutions.filter((s) =>
      s.some((e) => entryInvoiceKeys(e).some((k) => hintKeys.some((h) => invoiceKeysMatch(h, k)))),
    );
    if (withHint.length === 1) return withHint[0];
    if (withHint.length > 1) return null;
  }
  return solutions.length === 1 ? solutions[0] : null;
}

/**
 * Conservatieve koppeling: eerst external_id/informer_id, dan factuurnummer,
 * dan bedrag + tegenpartij + datum. Elke Informer-regel en elke administratieve
 * regel wordt hooguit één keer gekoppeld, zodat niets dubbel kan tellen.
 */
export function matchLegacyRecords(
  entries: LedgerEntry[],
  legacy: LegacyRecord[],
  options: MatchOptions = {},
): LegacyMatchResult {
  const byEntryKey = new Map<string, LegacyRecord>();
  const aliasesByEntryKey = new Map<string, LegacyRecord[]>();
  const matchedBy = new Map<string, MatchMethod>();
  const usedLegacy = new Set<string>();
  const hints = options.documentHints;

  // Synthetische hulprijen doen niet mee aan matching: ze bevatten geen
  // goedgekeurde toewijzing en zouden echte facturen verkeerd koppelen.
  const usable = legacy.filter((r) => !r.placeholder && !isSyntheticPlaceholder(r));

  const take = (
    entry: LedgerEntry,
    record: LegacyRecord,
    how: MatchMethod,
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

  // Meerdere oude representaties van dezelfde factuur/betaling vormen samen
  // één koppeling zolang ze niet tegenstrijdig zijn.
  const takeGroup = (
    entry: LedgerEntry,
    hits: LegacyRecord[],
    how: "invoice" | "document" | "payment",
  ) => {
    if (hits.length === 0) return;
    if (hits.length > 1 && !groupIsConsistent(hits)) return;
    const primary = pickPrimary(hits);
    take(entry, primary, how);
    const extra = hits.filter((r) => r.key !== primary.key);
    for (const r of extra) usedLegacy.add(r.key);
    if (extra.length > 0) {
      const key = ledgerKeyOf(entry);
      aliasesByEntryKey.set(key, [...(aliasesByEntryKey.get(key) ?? []), ...extra]);
    }
  };

  // 2. Factuurnummer.
  for (const entry of entries) {
    if (byEntryKey.has(ledgerKeyOf(entry))) continue;
    const self = asLedgerLike(entry);
    takeGroup(entry, available().filter((r) => sharesInvoiceNumber(self, asRecordLike(r))), "invoice");
  }

  // 3. Bedrag + tegenpartij + datum.
  for (const entry of entries) {
    if (byEntryKey.has(ledgerKeyOf(entry))) continue;
    const self = asLedgerLike(entry);
    takeGroup(entry, available().filter((r) => isSamePayment(self, asRecordLike(r))), "payment");
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
    if (extra.length > 0) {
      aliasesByEntryKey.set(key, [...(aliasesByEntryKey.get(key) ?? []), ...extra]);
    }

  }

  return {
    byEntryKey,
    aliasesByEntryKey,
    matchedBy,
    // Synthetische hulprijen zijn geen administratief aandachtspunt.
    unmatched: usable.filter((r) => !usedLegacy.has(r.key)),
  };
}

/* ---------------------------------------------------------------------------
 * Toewijzing van begrotingspost en dossier op basis van de bewaarde administratie
 * ------------------------------------------------------------------------- */

export interface LegacyAssignment {
  lineItemId: string | null;
  dossier: string | null;
  /** "legacy" = directe koppeling, "counterparty" = eenduidige historie. */
  via: "legacy" | "counterparty";
}

/**
 * Eenduidige tegenpartijgeschiedenis: alleen wanneer ALLE bruikbare historische
 * uitgaande records van dezelfde genormaliseerde tegenpartij naar exact dezelfde
 * niet-lege begrotingspost wijzen. Bij conflicten wordt niets toegewezen.
 */
export function counterpartyLineItemMap(legacy: LegacyRecord[]): Map<string, string> {
  const byName = new Map<string, Set<string>>();
  for (const r of legacy) {
    if (r.placeholder || isSyntheticPlaceholder(r)) continue;
    if (r.direction !== "out") continue;
    const name = normalizeCounterparty(r.counterparty);
    if (!name) continue;
    if (!r.lineItemId) continue; // lege post zegt niets, blokkeert de historie niet
    const set = byName.get(name) ?? new Set<string>();
    set.add(r.lineItemId);
    byName.set(name, set);
  }
  const result = new Map<string, string>();
  for (const [name, set] of byName) {
    if (set.size !== 1) continue; // alleen bij eenduidige historie
    const only = [...set][0];
    if (only) result.set(name, only);
  }
  return result;
}

/**
 * Bouwt per Informer-regel de administratieve toewijzing. Bedragen, facturen en
 * status komen altijd uit Informer; hier gaat het uitsluitend om begrotingspost
 * en dossier. Prioriteit: expliciete override (entry.line_item_id/dossier) >
 * directe legacy-koppeling > eenduidige tegenpartijhistorie.
 */
export function buildLegacyAssignments(
  entries: LedgerEntry[],
  legacy: LegacyRecord[],
  match: LegacyMatchResult,
): Map<string, LegacyAssignment> {
  const counterparties = counterpartyLineItemMap(legacy);
  const out = new Map<string, LegacyAssignment>();
  for (const entry of entries) {
    const key = ledgerKeyOf(entry);
    const record = match.byEntryKey.get(key);
    const dossier = record?.dossier ?? null;
    let lineItemId = record?.lineItemId ?? null;
    let via: LegacyAssignment["via"] = lineItemId || dossier ? "legacy" : "counterparty";
    if (!lineItemId && entry.doc_type !== "sales_invoice") {
      const fallback = counterparties.get(normalizeCounterparty(entry.relation_name));
      if (fallback) {
        lineItemId = fallback;
        if (!dossier) via = "counterparty";
      }
    }
    if (lineItemId || dossier) out.set(key, { lineItemId, dossier, via });
  }
  return out;
}
