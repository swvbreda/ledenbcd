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
export function computeOpenTotals(
  declarations: OpenTotalInput[],
  opts: { year: number; isAdmin: boolean; userId: string },
): OpenTotals {
  const rows = declarations.filter((d) => d.year === opts.year && isOpenDeclaration(d)
    && (opts.isAdmin || d.submitted_by === opts.userId));
  const map = new Map<string, OpenTotal & { key: string; name: string }>();
  let cents = 0;
  for (const d of rows) {
    const c = toCents(d.amount);
    cents += c;
    const key = d.board_member_id ?? `naam:${d.board_member_name}`;
    const entry = map.get(key) ?? { key, name: d.board_member_name, count: 0, cents: 0 };
    entry.count += 1; entry.cents += c;
    map.set(key, entry);
  }
  return { count: rows.length, cents, perMember: [...map.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name)) };
}
