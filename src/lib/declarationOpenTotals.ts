// Openstaand totaal van declaraties: definitief ingediend of goedgekeurd, en nog niet betaald.
export type OpenTotalInput = {
  year: number;
  amount: number | string | null;
  status: string;
  paid_at: string | null;
  bank_transaction_id?: string | null;
  submitted_by: string | null;
  board_member_id: string | null;
  board_member_name: string;
};

export type OpenTotal = { count: number; cents: number };
export type OpenTotals = OpenTotal & { perMember: Array<OpenTotal & { key: string; name: string }> };

export function isOpenDeclaration(d: OpenTotalInput): boolean {
  return (d.status === "pending" || d.status === "approved") && !d.paid_at && !d.bank_transaction_id;
}

const toCents = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Niet-admins tellen alleen eigen declaraties; statusfilter speelt geen rol. */
/** Exact de declaraties die in het open totaal meetellen (zelfde jaar-, scope- en openregels). */
export function selectOpenDeclarations<T extends OpenTotalInput>(
  declarations: T[],
  opts: { year: number; isAdmin: boolean; userId: string },
): T[] {
  return declarations.filter((d) => d.year === opts.year && isOpenDeclaration(d)
    && (opts.isAdmin || d.submitted_by === opts.userId));
}

export const openMemberKey = (d: Pick<OpenTotalInput, "board_member_id" | "board_member_name">) =>
  d.board_member_id ?? `naam:${d.board_member_name}`;

export function computeOpenTotals(
  declarations: OpenTotalInput[],
  opts: { year: number; isAdmin: boolean; userId: string },
): OpenTotals {
  const rows = selectOpenDeclarations(declarations, opts);
  const map = new Map<string, OpenTotal & { key: string; name: string }>();
  let cents = 0;
  for (const d of rows) {
    const c = toCents(d.amount);
    cents += c;
    const key = openMemberKey(d);
    const entry = map.get(key) ?? { key, name: d.board_member_name, count: 0, cents: 0 };
    entry.count += 1; entry.cents += c;
    map.set(key, entry);
  }
  return { count: rows.length, cents, perMember: [...map.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name)) };
}

const fmtEur = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
const nOpen = (c: number) => `${c} open ${c === 1 ? "declaratie" : "declaraties"}`;

/** Tekst onder het formulier: per gekozen bestuurslid uit de eigen toegankelijke cijfers, anders algemeen. */
export function formOpenNote(
  totals: OpenTotals,
  opts: { year: number; isAdmin: boolean; member?: { id: string; naam: string } | null },
): string | null {
  if (opts.member) {
    const m = opts.member;
    const entry = totals.perMember.find((p) => p.key === m.id || p.key === `naam:${m.naam}`);
    if (!entry) return null;
    return `Er staan voor ${m.naam} al ${nOpen(entry.count)} (${fmtEur(entry.cents)}). Deze nieuwe declaratie wordt apart ingediend en bij dat openstaande totaal opgeteld.`;
  }
  if (totals.count === 0) return null;
  return `Er staan in ${opts.year} ${nOpen(totals.count)} (${fmtEur(totals.cents)})${opts.isAdmin ? " over alle bestuurders" : ""}. Elke nieuwe declaratie wordt apart ingediend en bij het openstaande totaal opgeteld.`;
}
