import { UNKNOWN_BANK } from "@/lib/bankFromIban";

export type BankAggregateGroup = { bank: string; aantal: number; pct: number };
/** Rij uit get_member_bank_groups: uitsluitend banknaam/categorie en aantallen. */
export type BankGroupRow = { bank: string; aantal: number; totaal_leden: number };
/** Rij uit get_member_psp_groups: bekende aanbieder of "Anders", aantal vestigingen, pct. */
export type PspGroupRow = { naam: string; aantal: number; pct: number };

/** Sorteert en berekent percentages zoals de admin-bankgroepering. */
export function bankGroupsFromAggregate(rows: BankGroupRow[]): BankAggregateGroup[] {
  const totaal = rows[0]?.totaal_leden ?? 0;
  return rows
    .map((r) => ({
      bank: r.bank || UNKNOWN_BANK,
      aantal: Number(r.aantal),
      pct: totaal ? Math.round((Number(r.aantal) / totaal) * 100) : 0,
    }))
    .sort((a, b) => (a.bank === UNKNOWN_BANK ? 1 : b.bank === UNKNOWN_BANK ? -1 : b.aantal - a.aantal));
}

/** Zelfde sortering als usePinverwerkers ("Anders" achteraan). */
export function pspGroupsFromAggregate(rows: PspGroupRow[]) {
  return rows
    .map((r) => ({ naam: r.naam, aantal: Number(r.aantal), pct: Number(r.pct) }))
    .sort((a, b) => (a.naam === "Anders" ? 1 : b.naam === "Anders" ? -1 : b.aantal - a.aantal));
}
