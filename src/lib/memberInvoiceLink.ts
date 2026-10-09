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
  relation_name?: string | null;
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
  memberNames?: Map<number, string>,
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

  const normName = (v: string | null | undefined) => String(v ?? "").toLowerCase().replace(/\b(b\.?v\.?|v\.?o\.?f\.?)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const byName = new Map<string, number[]>();
  for (const [id, n] of memberNames ?? []) {
    const k = normName(n);
    if (k.length >= 3) (byName.get(k) ?? byName.set(k, []).get(k)!).push(id);
  }
  const contribByMember = new Map(contributions.filter((c) => c.year === year).map((c) => [c.member_id, c]));

  const first = entries.filter((e) => !e.deleted_at && e.year === year).map((e): MemberLinkResult => {
    const direct = byExternal.get(e.informer_id);
    if (direct) {
      const r = relationCheck(e, direct);
      return r ? { entry: e, outcome: "conflict", contribution: direct, reason: r } : { entry: e, outcome: "linked", contribution: direct };
    }
    const cands = byNumber.get(normalizeRef(e.invoice_number)) ?? [];
    if (cands.length === 0) {
      // Terugval: exact unieke ledennaam + bedrag + jaar, alleen als contributie nog geen document heeft.
      const ids = byName.get(normName(e.relation_name)) ?? [];
      if (ids.length > 1) return { entry: e, outcome: "conflict", reason: "Naam past bij meerdere leden" };
      const c = ids.length === 1 ? contribByMember.get(ids[0]!) : undefined;
      if (!c) return { entry: e, outcome: "unmatched", reason: "Geen contributie met dit factuurnummer of deze naam" };
      if (Math.abs(Number(c.amount) - Number(e.amount_incl)) >= 0.005) return { entry: e, outcome: "conflict", contribution: c, reason: "Naam past, bedrag wijkt af" };
      if (c.external_invoice_id) return { entry: e, outcome: "conflict", contribution: c, reason: `Contributie al gekoppeld aan document ${c.external_invoice_id}` };
      const r = relationCheck(e, c);
      if (r) return { entry: e, outcome: "conflict", contribution: c, reason: r };
      return { entry: e, outcome: "propose", contribution: c, reason: "Op naam" };
    }
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
  // Twee documenten voor dezelfde contributie: geen van beide automatisch koppelen.
  const n = new Map<string, number>();
  for (const r of first) if (r.outcome === "propose") n.set(r.contribution!.id, (n.get(r.contribution!.id) ?? 0) + 1);
  return first.map((r) => r.outcome === "propose" && (n.get(r.contribution!.id) ?? 0) > 1
    ? { ...r, outcome: "conflict" as const, reason: "Meerdere documenten voor dezelfde contributie" } : r);
}
