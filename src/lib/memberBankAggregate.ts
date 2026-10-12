import { bankFromIban, UNKNOWN_BANK } from "@/lib/bankFromIban";
import type { BankAggregateRow } from "@/lib/representationSummary";

export type BankAggregateGroup = { bank: string; aantal: number; pct: number };

/** Zet bankcode-aantallen om naar banknamen; geen individuele leden of IBANs. */
export function bankGroupsFromAggregate(rows: BankAggregateRow[]): BankAggregateGroup[] {
  const totaal = rows[0]?.totaal_leden ?? 0;
  const map = new Map<string, number>();
  for (const r of rows) {
    const bank = r.bank_code ? bankFromIban(`NL00${r.bank_code}0000000000`) : UNKNOWN_BANK;
    map.set(bank, (map.get(bank) ?? 0) + Number(r.aantal));
  }
  return Array.from(map.entries())
    .map(([bank, aantal]) => ({ bank, aantal, pct: totaal ? Math.round((aantal / totaal) * 100) : 0 }))
    .sort((a, b) => (a.bank === UNKNOWN_BANK ? 1 : b.bank === UNKNOWN_BANK ? -1 : b.aantal - a.aantal));
}
