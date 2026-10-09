// Contributiefacturen (Informer) koppelen aan member_contributions.
// Alleen exact uniek factuurnummer + bedrag + jaar. Bestaande koppelingen en de
// relatiemap worden nooit overschreven; afwijkingen worden als conflict getoond.
import { normalizeRef } from "./bankInvoiceMatch";

export interface SalesEntry {
  informer_id: string;
  invoice_number: string | null;
  amount_incl: number;
  year: number;
  relation_id: string | null;
  deleted_at?: string | null;
}
export interface ContributionRow {
  id: string;
  member_id: number;
  year: number;
  amount: number;
  invoice_number: string | null;
  external_invoice_id: string | null;
}
export interface DebtorMapRow { member_id: number; informer_debtor_id: string }

export type MemberLinkOutcome = "linked" | "propose" | "conflict" | "unmatched";
export interface MemberLinkResult {
  entry: SalesEntry;
  outcome: MemberLinkOutcome;
  contribution?: ContributionRow;
  reason?: string;
}

export function planMemberLinks(
  entries: SalesEntry[],
  contributions: ContributionRow[],
  debtorMap: DebtorMapRow[],
  year: number,
): MemberLinkResult[] {
  const byExternal = new Map(contributions.filter((c) => c.external_invoice_id).map((c) => [String(c.external_invoice_id), c]));
  const byNumber = new Map<string, ContributionRow[]>();
  for (const c of contributions) {
    if (c.year !== year) continue;
    const n = normalizeRef(c.invoice_number);
    if (n.length < 3) continue;
    (byNumber.get(n) ?? byNumber.set(n, []).get(n)!).push(c);
  }
  const debtorOf = new Map(debtorMap.map((d) => [d.member_id, String(d.informer_debtor_id)]));
  const relationCheck = (e: SalesEntry, c: ContributionRow): string | undefined => {
    const mapped = debtorOf.get(c.member_id);
    if (mapped && e.relation_id && mapped !== String(e.relation_id))
      return `Relatie in Informer (${e.relation_id}) wijkt af van relatiemap lid ${c.member_id} (${mapped})`;
    return undefined;
  };

  return entries.filter((e) => !e.deleted_at && e.year === year).map((e) => {
    const direct = byExternal.get(e.informer_id);
    if (direct) {
      const r = relationCheck(e, direct);
      return r ? { entry: e, outcome: "conflict", contribution: direct, reason: r } : { entry: e, outcome: "linked", contribution: direct };
    }
    const cands = byNumber.get(normalizeRef(e.invoice_number)) ?? [];
    if (cands.length === 0) return { entry: e, outcome: "unmatched", reason: "Geen contributie met dit factuurnummer" };
    if (cands.length > 1) return { entry: e, outcome: "conflict", reason: "Factuurnummer bij meerdere leden" };
    const c = cands[0]!;
    if (Math.abs(Number(c.amount) - Number(e.amount_incl)) >= 0.005)
      return { entry: e, outcome: "conflict", contribution: c, reason: "Bedrag wijkt af" };
    if (c.external_invoice_id && c.external_invoice_id !== e.informer_id)
      return { entry: e, outcome: "conflict", contribution: c, reason: `Contributie al gekoppeld aan document ${c.external_invoice_id}` };
    const r = relationCheck(e, c);
    if (r) return { entry: e, outcome: "conflict", contribution: c, reason: r };
    return { entry: e, outcome: "propose", contribution: c };
  });
}
