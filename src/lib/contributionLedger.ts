// Contributiefacturen: uitsluitend afgeleid van de boekhouding (Informer /
// ledger_entries_v). Eén gedeelde classificatie voor dashboard, contributietab,
// dialoog en de ledenkaart, zodat alle schermen exact dezelfde regels tonen.
// Lokale contributietabellen (member_contributions, contribution_invoices,
// contribution_payments) spelen hier bewust geen enkele rol.

import { isContributionRevenue, revenueEntries, type LedgerEntry } from "@/lib/ledger";

export { isContributionRevenue };

export interface ContributionInvoiceRow {
  /** Stabiele sleutel: doc_type + informer_id. */
  key: string;
  informerId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  relationId: string | null;
  relationName: string;
  /** Gekoppeld lid via informer_debtor_map; null als de koppeling ontbreekt. */
  memberId: number | null;
  amount: number;
  paidAmount: number;
  openAmount: number;
  status: "paid" | "open";
}

export interface ContributionTotals {
  count: number;
  invoiced: number;
  paid: number;
  open: number;
}

const num = (value: unknown) => Number(value) || 0;

/** Alle meetellende contributiefacturen van de boekhouding, exact één rij per factuur. */
export function buildContributionInvoiceRows(
  entries: LedgerEntry[],
  memberByRelationId: Map<string, number> = new Map(),
): ContributionInvoiceRow[] {
  return revenueEntries(entries)
    .filter(isContributionRevenue)
    .map((e) => ({
      key: `${e.doc_type}:${e.informer_id}`,
      informerId: String(e.informer_id),
      invoiceNumber: e.invoice_number ?? null,
      invoiceDate: e.entry_date ?? null,
      relationId: e.relation_id ? String(e.relation_id) : null,
      relationName: e.relation_name ?? "",
      memberId: e.relation_id ? memberByRelationId.get(String(e.relation_id)) ?? null : null,
      amount: num(e.amount_incl),
      paidAmount: num(e.paid_amount),
      openAmount: num(e.open_amount),
      status: num(e.open_amount) <= 0.005 ? ("paid" as const) : ("open" as const),
    }))
    .sort((a, b) => (a.invoiceNumber ?? "").localeCompare(b.invoiceNumber ?? "", "nl"));
}

/** Overige verkoopfacturen (geen contributie) uit de boekhouding. */
export function buildOtherRevenueRows(
  entries: LedgerEntry[],
  memberByRelationId: Map<string, number> = new Map(),
): ContributionInvoiceRow[] {
  const contribution = new Set(
    buildContributionInvoiceRows(entries, memberByRelationId).map((r) => r.key),
  );
  return revenueEntries(entries)
    .filter((e) => !contribution.has(`${e.doc_type}:${e.informer_id}`))
    .map((e) => ({
      key: `${e.doc_type}:${e.informer_id}`,
      informerId: String(e.informer_id),
      invoiceNumber: e.invoice_number ?? null,
      invoiceDate: e.entry_date ?? null,
      relationId: e.relation_id ? String(e.relation_id) : null,
      relationName: e.relation_name ?? "",
      memberId: e.relation_id ? memberByRelationId.get(String(e.relation_id)) ?? null : null,
      amount: num(e.amount_incl),
      paidAmount: num(e.paid_amount),
      openAmount: num(e.open_amount),
      status: num(e.open_amount) <= 0.005 ? ("paid" as const) : ("open" as const),
    }));
}

export function summarizeInvoiceRows(rows: ContributionInvoiceRow[]): ContributionTotals {
  return rows.reduce<ContributionTotals>(
    (acc, r) => ({
      count: acc.count + 1,
      invoiced: acc.invoiced + r.amount,
      paid: acc.paid + r.paidAmount,
      open: acc.open + r.openAmount,
    }),
    { count: 0, invoiced: 0, paid: 0, open: 0 },
  );
}
