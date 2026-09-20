// Behoud van de bestaande administratieve indeling bij canonieke Informer-regels.
//
// Informer (ledger_entries_v) blijft de enige bron voor bedragen, facturen en
// betaalstatus. De historische administratie (budget_expenses en
// ponto_transactions) levert uitsluitend de toewijzing: begrotingspost,
// dossier, splits en documentkoppeling. Deze module is puur, zodat begroting,
// dossiers en controle exact dezelfde koppeling gebruiken.

import {
  isSamePayment,
  sharesInvoiceNumber,
  invoiceKeysOf,
  invoiceKeysMatch,
} from "@/lib/ledgerDedupe";
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
   * Administratieve dossierverdeling van deze mutatie. Een deelbedrag kan een
   * eigen Informer-factuur vertegenwoordigen (gesplitste betaling).
   */
  splits?: { dossier: string; amount: number }[];
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

export type MatchMethod =
  | "external_id"
  | "invoice"
  | "document"
  | "payment"
  | "combined"
  | "split";


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

/** Alle factuursleutels van een lokale mutatie: eigen velden én documenthints. */
function recordHintKeys(record: LegacyRecord, hints?: DocumentHints): string[] {
  return [...new Set([...invoiceKeysOf(asRecordLike(record)), ...hintKeysFor(record, hints)])];
}

/**
 * True als het volledige bedrag óf een dossierdeel van de lokale mutatie exact
 * gelijk is aan het bedrag van de Informer-regel.
 */
function relevantAmountMatches(record: LegacyRecord, entry: LedgerEntry): boolean {
  const target = cents(Number(entry.amount_incl) || 0);
  if (target === 0) return false;
  if (cents(record.amount) === target) return true;
  return (record.splits || []).some((s) => cents(s.amount) === target);
}


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
export interface CombinationOptions {
  /** Te dekken bedrag; standaard het volledige bedrag van de mutatie. */
  targetAmount?: number;
  /** Minimaal aantal facturen in de combinatie (standaard 2). */
  minPicks?: number;
  /** Ook zonder documenthint alleen facturen rond de betaaldatum meenemen. */
  nearDateOnly?: boolean;
}

export function findCombination(
  record: LegacyRecord,
  candidates: LedgerEntry[],
  hintKeys: string[] = [],
  options: CombinationOptions = {},
): LedgerEntry[] | null {
  const target = cents(options.targetAmount ?? record.amount);
  const minPicks = options.minPicks ?? 2;
  if (target === 0) return null;
  const isHinted = (e: LedgerEntry) =>
    hintKeys.length > 0 &&
    entryInvoiceKeys(e).some((k) => hintKeys.some((h) => invoiceKeysMatch(h, k)));
  const hinted = candidates.filter(isHinted);
  // Met een documenthint zoeken we gericht: de bekende factuur hoort er zeker
  // bij, aangevuld met facturen rond de betaaldatum. Dat voorkomt willekeurige
  // combinaties bij leveranciers met veel facturen.
  const scope =
    hinted.length > 0 || options.nearDateOnly
      ? candidates.filter(
          (e) => isHinted(e) || Math.abs(daysBetween(record.date, e.entry_date)) <= 21,
        )
      : candidates;
  const pool = [...scope].sort(
    (a, b) =>
      Number(isHinted(b)) - Number(isHinted(a)) ||
      Math.abs(daysBetween(record.date, a.entry_date)) -
        Math.abs(daysBetween(record.date, b.entry_date)),
  ).slice(0, 12);
  const solutions: LedgerEntry[][] = [];
  const search = (index: number, picked: LedgerEntry[], sum: number) => {
    if (solutions.length > 8) return;
    if (picked.length >= minPicks && sum === target) {
      solutions.push([...picked]);
      return;
    }
    if (index >= pool.length || picked.length >= 4 || sum > target) return;
    search(index + 1, [...picked, pool[index]], sum + cents(Number(pool[index].amount_incl) || 0));
    search(index + 1, picked, sum);
  };
  search(0, [], 0);
  if (solutions.length === 0) return null;
  if (hinted.length > 0) {
    // Alle uit documenten bekende facturen moeten in de combinatie zitten.
    const withHint = solutions.filter((s) => hinted.every((h) => s.includes(h)));
    if (withHint.length === 1) return withHint[0];
    return null;
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

  // 3. Gecombineerde betaling: één bankmutatie dekt exact meerdere facturen.
  // Dit gaat vóór de losse document-/betaalkoppeling, anders zou dezelfde
  // betaling al aan één factuur vastzitten.
  const combined: CombinedPayment[] = [];
  const combinedByEntryKey = new Map<string, LegacyRecord>();
  const claimed = () => new Set<string>([...byEntryKey.keys(), ...combinedByEntryKey.keys()]);
  for (const record of available()) {
    const party = normalizeCounterparty(record.counterparty);
    const hintKeys = hintKeysFor(record, hints);
    if (!party && hintKeys.length === 0) continue;
    const taken = claimed();
    const wantsSales = record.direction === "in";
    const relevant = entries.filter(
      (e) => e.counts_in_totals && wantsSales === (e.doc_type === "sales_invoice"),
    );
    const isHinted = (e: LedgerEntry) =>
      hintKeys.length > 0 &&
      entryInvoiceKeys(e).some((k) => hintKeys.some((h) => invoiceKeysMatch(h, k)));
    // Een uit een document bekende factuur die al direct gekoppeld is, telt
    // mee voor het betaalde bedrag maar wordt niet opnieuw toegewezen.
    const alreadyLinked = relevant.filter((e) => isHinted(e) && taken.has(ledgerKeyOf(e)));
    const covered = alreadyLinked.reduce((s, e) => s + Math.abs(Number(e.amount_incl) || 0), 0);
    const residual = Math.round((record.amount - covered) * 100) / 100;
    if (residual <= 0) continue;
    const candidates = relevant.filter((e) => {
      if (taken.has(ledgerKeyOf(e))) return false;
      if (isHinted(e)) return true;
      if (!party || normalizeCounterparty(e.relation_name) !== party) return false;
      // Facturen worden na de factuurdatum betaald; een klein voorschot mag.
      const delta = daysBetween(record.date, e.entry_date);
      return delta >= -14 && delta <= 180;
    });
    const minPicks = alreadyLinked.length > 0 ? 1 : 2;
    if (candidates.length < minPicks) continue;
    const hit = findCombination(record, candidates, hintKeys, {
      targetAmount: residual,
      minPicks,
      nearDateOnly: alreadyLinked.length > 0,
    });
    if (!hit || hit.length + alreadyLinked.length < 2) continue;
    const entryKeys = hit.map(ledgerKeyOf);
    for (const key of entryKeys) {
      combinedByEntryKey.set(key, record);
      matchedBy.set(key, "combined");
    }
    combined.push({
      legacyKey: record.key,
      entryKeys: [...alreadyLinked.map(ledgerKeyOf), ...entryKeys],
    });
    usedLegacy.add(record.key);
  }

  // 4. Factuurnummer uit een gekoppeld document (bv. "Declaratie 20260688.pdf").
  if (hints && hints.size > 0) {
    for (const entry of entries) {
      if (byEntryKey.has(ledgerKeyOf(entry))) continue;
      const keys = entryInvoiceKeys(entry);
      if (keys.length === 0) continue;
      const hits = available().filter((r) =>
        hintKeysFor(r, hints).some((h) => keys.some((k) => invoiceKeysMatch(h, k))),
      );
      takeGroup(entry, hits, "document");
    }
  }

  // 5. Bedrag + tegenpartij + datum.
  for (const entry of entries) {
    if (byEntryKey.has(ledgerKeyOf(entry))) continue;
    const self = asLedgerLike(entry);
    takeGroup(entry, available().filter((r) => isSamePayment(self, asRecordLike(r))), "payment");
  }

  // 5b. Gesplitste betaling: een grotere bankmutatie waarvan één dossierdeel
  // exact deze factuur dekt. De tegenpartijnaam mag afwijken; de factuurhint en
  // het deelbedrag zijn leidend. Mutaties zonder dossierverdeling blijven buiten
  // deze stap, zodat eerdere conflictregels intact blijven.
  for (const record of available()) {
    if (!record.splits || record.splits.length === 0) continue;
    const keys = recordHintKeys(record, hints);
    if (keys.length === 0) continue;
    for (const entry of entries) {
      if (!entry.counts_in_totals) continue;
      const ekey = ledgerKeyOf(entry);
      if (byEntryKey.has(ekey) || combinedByEntryKey.has(ekey)) continue;
      if (!entryInvoiceKeys(entry).some((k) => keys.some((h) => invoiceKeysMatch(h, k)))) continue;
      const target = cents(Number(entry.amount_incl) || 0);
      const split = record.splits.find((s) => cents(s.amount) === target);
      if (!split) continue;
      take(entry, { ...record, dossier: split.dossier }, "split");
      break;
    }
  }
  // 5c. Is een gekoppelde mutatie over dossiers verdeeld, dan geldt voor deze
  // factuur het dossier van het deel dat exact haar bedrag dekt.
  for (const entry of entries) {
    const ekey = ledgerKeyOf(entry);
    const record = byEntryKey.get(ekey);
    if (!record?.splits || record.splits.length === 0) continue;
    if (cents(record.amount) === cents(Number(entry.amount_incl) || 0)) continue;
    const split = record.splits.find((s) => cents(s.amount) === cents(Number(entry.amount_incl) || 0));
    if (!split) continue;
    byEntryKey.set(ekey, { ...record, dossier: split.dossier });
    matchedBy.set(ekey, "split");
  }

  // 5d. Deelbetaling zonder bruikbare factuurhint: een bankmutatie (of een
  // dossierdeel daarvan) die exact één canonieke factuur van dezelfde
  // tegenpartij dekt. Streng: gelijk bedrag op centen, gelijke richting,
  // eenduidige tegenpartij, plausibel datumvenster en precies één kandidaat.
  for (const record of available()) {
    const party = normalizeCounterparty(record.counterparty);
    if (!party) continue;
    const wantsSales = record.direction === "in";
    const portions = [
      { amount: record.amount, dossier: record.dossier },
      ...(record.splits || []).map((s) => ({ amount: s.amount, dossier: s.dossier })),
    ];
    let linked = false;
    for (const portion of portions) {
      if (linked) break;
      const target = cents(portion.amount);
      if (target === 0) continue;
      const candidates = entries.filter((e) => {
        if (!e.counts_in_totals) continue as never;
        return false;
      });
      void candidates;
      const hits = entries.filter((e) => {
        if (!e.counts_in_totals) return false;
        if (wantsSales !== (e.doc_type === "sales_invoice")) return false;
        const ekey = ledgerKeyOf(e);
        if (byEntryKey.has(ekey) || combinedByEntryKey.has(ekey)) return false;
        if (cents(Number(e.amount_incl) || 0) !== target) return false;
        if (normalizeCounterparty(e.relation_name) !== party) return false;
        const delta = daysBetween(record.date, e.entry_date);
        return delta >= -30 && delta <= 180;
      });
      if (hits.length !== 1) continue;
      take(hits[0], { ...record, dossier: portion.dossier ?? record.dossier }, "split");
      linked = true;
    }
  }

  // 6. Dezelfde oude betaling die zowel als boeking als bankmutatie bestaat:
  // die hangt als alias aan de Informer-regel (alleen voor documenten) en
  // verschijnt dus niet apart als "nog niet gekoppeld". Er wordt zowel met de
  // primaire administratieve regel als met de canonieke Informer-regel zelf
  // vergeleken, zodat een bankregel met hetzelfde factuurnummer nooit dubbel
  // blijft staan.
  const entryByKey = new Map(entries.map((e) => [ledgerKeyOf(e), e]));
  for (const [key, record] of byEntryKey) {
    const entry = entryByKey.get(key);
    const self = entry ? asLedgerLike(entry) : null;
    const extra = available().filter((r) => {
      if (r.key === record.key) return false;
      if (
        isSamePayment(asRecordLike(record), asRecordLike(r)) ||
        sharesInvoiceNumber(asRecordLike(record), asRecordLike(r))
      )
        return true;
      if (!entry || !self) return false;
      if (isSamePayment(self, asRecordLike(r))) return true;
      const keys = recordHintKeys(r, hints);
      const hit =
        sharesInvoiceNumber(self, asRecordLike(r)) ||
        entryInvoiceKeys(entry).some((k) => keys.some((h) => invoiceKeysMatch(h, k)));
      if (!hit) return false;
      // Alleen met exact hetzelfde bedrag (of splitbedrag), dezelfde richting
      // en een plausibele datum is dit aantoonbaar dezelfde betaling.
      if ((self.direction || "out") !== r.direction) return false;
      const delta = daysBetween(r.date, entry.entry_date);
      if (delta < -30 || delta > 180) return false;
      return relevantAmountMatches(r, entry);
    });
    for (const r of extra) usedLegacy.add(r.key);
    if (extra.length > 0) {
      aliasesByEntryKey.set(key, [...(aliasesByEntryKey.get(key) ?? []), ...extra]);
    }
  }




  return {
    byEntryKey,
    aliasesByEntryKey,
    matchedBy,
    combined,
    combinedByEntryKey,
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
  /**
   * "legacy" = directe koppeling, "combined" = deel van één gecombineerde
   * betaling, "counterparty" = eenduidige historie.
   */
  via: "legacy" | "combined" | "counterparty";
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
    const direct = match.byEntryKey.get(key);
    const grouped = match.combinedByEntryKey.get(key);
    const record = direct ?? grouped;
    const dossier = record?.dossier ?? null;
    let lineItemId = record?.lineItemId ?? null;
    let via: LegacyAssignment["via"] =
      lineItemId || dossier ? (direct ? "legacy" : "combined") : "counterparty";
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
