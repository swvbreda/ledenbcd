// Canonieke financiële regels: afgeleid van Informer (informer_ledger_entries)
// plus lokale toevoegingen (ledger_entry_overrides) via de view ledger_entries_v.
// Dit bestand bevat uitsluitend pure functies, zodat totalen in begroting,
// resultaat en dossiers gegarandeerd uit dezelfde berekening komen.

import { isExcludedDossier } from "@/lib/budgetExclusions";

export type LedgerDocType = "sales_invoice" | "purchase_invoice";
export type LedgerStatus = "draft" | "open" | "paid" | "cancelled" | "unprocessed";

export interface LedgerEntry {
  id: string;
  doc_type: LedgerDocType;
  informer_id: string;
  year: number;
  entry_date: string | null;
  due_date: string | null;
  amount_incl: number;
  amount_excl: number | null;
  paid_amount: number;
  open_amount: number;
  status: LedgerStatus | string;
  status_raw: string | null;
  relation_id: string | null;
  relation_name: string | null;
  relation_number: string | null;
  invoice_number: string | null;
  ledger_account: string | null;
  description: string | null;
  deleted_at: string | null;
  dossier: string | null;
  line_item_id: string | null;
  note: string | null;
  excluded: boolean;
  counts_in_totals: boolean;
  ponto_transaction_id: string | null;
  payment_date: string | null;
}

export interface LedgerSplit {
  informer_id: string;
  doc_type: LedgerDocType;
  dossier: string;
  amount: number;
}

/** Telt deze regel mee in werkelijke bedragen? Alleen echte, niet-uitgesloten posten. */
export function countsInTotals(entry: LedgerEntry): boolean {
  return (
    !entry.deleted_at &&
    !entry.excluded &&
    (entry.status === "open" || entry.status === "paid")
  );
}

/** Regels die aandacht vragen: concept, te verwerken, geannuleerd of €0. */
export function needsAttention(entry: LedgerEntry): boolean {
  if (entry.deleted_at) return true;
  if (entry.status === "draft" || entry.status === "unprocessed" || entry.status === "cancelled") return true;
  return Number(entry.amount_incl) === 0;
}

/**
 * DE canonieke set meetellende regels. Dashboard, begroting-vs-werkelijk,
 * resultaat, dossiers en de controlemodule gebruiken allemaal deze functie,
 * zodat hun totalen per definitie gelijk zijn. Regels uit een uitgesloten
 * dossier ("buiten begroting") tellen nergens mee.
 */
export function countableEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.filter((e) => countsInTotals(e) && !isExcludedDossier(e.dossier));
}

/** Meetellende inkoopfacturen — de enige bron voor het uitgaventotaal. */
export function expenseEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return countableEntries(entries).filter((e) => e.doc_type === "purchase_invoice");
}

/** Meetellende verkoopfacturen — de enige bron voor het opbrengstentotaal. */
export function revenueEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return countableEntries(entries).filter((e) => e.doc_type === "sales_invoice");
}

export function sumAmount(entries: LedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + (Number(e.amount_incl) || 0), 0);
}

export function totalExpenses(entries: LedgerEntry[]): number {
  return sumAmount(expenseEntries(entries));
}

export function totalRevenue(entries: LedgerEntry[]): number {
  return sumAmount(revenueEntries(entries));
}

export function netResult(entries: LedgerEntry[]): number {
  return totalRevenue(entries) - totalExpenses(entries);
}

export function openSalesTotal(entries: LedgerEntry[]): number {
  return revenueEntries(entries).reduce((sum, e) => sum + (Number(e.open_amount) || 0), 0);
}

export function openPurchaseTotal(entries: LedgerEntry[]): number {
  return expenseEntries(entries).reduce((sum, e) => sum + (Number(e.open_amount) || 0), 0);
}

/** Totalen per dossier; splits gaan voor de regel zelf en tellen exact eenmaal. */
export function totalsByDossier(
  entries: LedgerEntry[],
  splits: LedgerSplit[] = [],
): Record<string, number> {
  const splitsByEntry = new Map<string, LedgerSplit[]>();
  for (const split of splits) {
    const key = `${split.doc_type}:${split.informer_id}`;
    const list = splitsByEntry.get(key) ?? [];
    list.push(split);
    splitsByEntry.set(key, list);
  }

  const totals: Record<string, number> = {};
  const add = (dossier: string | null, amount: number) => {
    const key = dossier?.trim() || "Niet toegewezen";
    totals[key] = (totals[key] ?? 0) + amount;
  };

  for (const entry of countableEntries(entries)) {
    if (entry.doc_type !== "purchase_invoice") continue;
    const key = `${entry.doc_type}:${entry.informer_id}`;
    const entrySplits = splitsByEntry.get(key);
    if (entrySplits && entrySplits.length > 0) {
      for (const split of entrySplits) add(split.dossier, Number(split.amount) || 0);
      continue;
    }
    add(entry.dossier, Number(entry.amount_incl) || 0);
  }
  return totals;
}

/** Splits moeten exact optellen tot het factuurbedrag (tolerantie 1 cent). */
export function splitsBalance(entry: LedgerEntry, splits: LedgerSplit[]): boolean {
  const relevant = splits.filter(
    (s) => s.informer_id === entry.informer_id && s.doc_type === entry.doc_type,
  );
  if (relevant.length === 0) return true;
  const sum = relevant.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  return Math.abs(sum - Number(entry.amount_incl)) < 0.011;
}

export interface LedgerReadiness {
  /** Zijn de bedragen uit de boekhouding bruikbaar als werkelijke cijfers? */
  ready: boolean;
  /** Zijn de totalen aantoonbaar gelijk aan de boekhouding? */
  reconciled: boolean;
  counted: number;
  zeroAmount: number;
  attention: number;
  withoutLedgerAccount: number;
  lastSyncAt: string | null;
  reasons: string[];
}

/**
 * Bepaalt of de canonieke gegevens gebruikt mogen worden als boekhoudkundige
 * werkelijkheid. Zonder geslaagde sync of met €0-bedragen in meetellende regels
 * is het antwoord nee; dan toont de UI "niet volledig gereconcilieerd".
 */
export function ledgerReadiness(
  entries: LedgerEntry[],
  lastSyncAt: string | null,
  reference?: { expenses?: number | null; revenue?: number | null },
): LedgerReadiness {
  const counted = countableEntries(entries);
  const zeroAmount = counted.filter((e) => Number(e.amount_incl) === 0).length;
  const attention = entries.filter(needsAttention).length;
  const withoutLedgerAccount = counted.filter((e) => !e.ledger_account).length;
  const reasons: string[] = [];

  if (!lastSyncAt) reasons.push("Nog geen geslaagde synchronisatie voor dit boekjaar.");
  if (counted.length === 0) reasons.push("Geen meetellende regels uit de boekhouding.");
  if (zeroAmount > 0) reasons.push(`${zeroAmount} meetellende regels zonder bedrag.`);

  const ready = reasons.length === 0;

  const matches = (ref: number | null | undefined, actual: number) =>
    typeof ref === "number" && Number.isFinite(ref) && Math.abs(ref - actual) < 0.011;
  const reconciled =
    ready &&
    matches(reference?.expenses, totalExpenses(entries)) &&
    matches(reference?.revenue, totalRevenue(entries));

  return {
    ready,
    reconciled,
    counted: counted.length,
    zeroAmount,
    attention,
    withoutLedgerAccount,
    lastSyncAt,
    reasons,
  };
}
