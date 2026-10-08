// Pure regels voor het admin-paneel "Nog te beoordelen". Leest alleen; wijzigt niets.

export type Contribution = { id: string; member_id: number; year: number; amount: number; paid: boolean; external_invoice_id: string | null };
export type ContributionReview = { id: string; member_id: number; name: string; year: number; amount: number; reason: string };

/** Betaalde contributies zonder Informer-factuur én zonder bankdossier met "(#lidnummer)". */
export function contributionsToReview(rows: Contribution[], dossiers: (string | null)[], names: Map<number, string>, year: number): ContributionReview[] {
  const tagged = new Set<number>();
  for (const d of dossiers) for (const m of String(d ?? "").matchAll(/\(#(\d+)\)/g)) tagged.add(Number(m[1]));
  return rows
    .filter((c) => c.year === year && c.paid && !c.external_invoice_id && !tagged.has(c.member_id))
    .map((c) => ({ id: c.id, member_id: c.member_id, name: names.get(c.member_id) ?? `Lid ${c.member_id}`, year: c.year, amount: Number(c.amount),
      reason: "Geen Informer-factuur en geen bankafschrijving met dit lidnummer in het dossier" }))
    .sort((a, b) => a.member_id - b.member_id);
}

/** Rekening → bedoelde post (naam), volgens de keuzes van de administratie. */
export const ACCOUNT_POST_RULES: { prefix: string; post: string }[] = [
  { prefix: "4009", post: "Onkosten vergoedingen" },
  { prefix: "4495", post: "Onkosten vergoedingen" },
  { prefix: "5010", post: "Reiskosten" },
  { prefix: "4340", post: "Juridische kosten / bestuurlijk advies" },
];
export const intendedPost = (account: string | null) => ACCOUNT_POST_RULES.find((r) => String(account ?? "").startsWith(r.prefix))?.post ?? null;

export type LedgerRow = { informer_id: string; ledger_account: string | null; amount_incl: number | null; relation_name: string | null; entry_date: string | null };
export type LedgerException = LedgerRow & { intended: string; currentPost: string; dossier: string | null };

/** Boekingen met een regelrekening maar zonder handmatige post, waar een eerdere toewijzing een andere post noemt: alleen tonen, niet overschrijven. */
export function ledgerExceptions(rows: LedgerRow[], overrideLineItem: Map<string, string | null>, legacyPostName: Map<string, string>, dossier: Map<string, string | null>): LedgerException[] {
  const out: LedgerException[] = [];
  for (const r of rows) {
    const intended = intendedPost(r.ledger_account);
    if (!intended || overrideLineItem.get(r.informer_id)) continue;
    const current = legacyPostName.get(r.informer_id);
    if (current && !current.startsWith(intended)) out.push({ ...r, intended, currentPost: current, dossier: dossier.get(r.informer_id) ?? null });
  }
  return out;
}

export type DeclLite = { id: string; amount: number; status: string; informer_status: string; year: number; expense_date: string; board_member_name: string | null; dossier?: string | null; budget_line_item_id?: string | null; appointment?: string | null };
export type DeclReview = { id: string; label: string; reason: string };

/** Declaraties die aandacht nodig hebben, zonder bedragen te wijzigen. */
export function declarationsToReview(rows: DeclLite[], closedYears: number[]): DeclReview[] {
  const out: DeclReview[] = [];
  for (const d of rows) {
    if (d.status === "rejected") continue;
    const label = `${d.expense_date} · ${d.board_member_name ?? "—"}`;
    if (Number(d.amount) === 0) out.push({ id: d.id, label, reason: "Bedrag €0 — kan via Wijzigen worden aangevuld" });
    if (d.informer_status === "error") out.push({ id: d.id, label, reason: "Verzenden naar Informer mislukt — opnieuw proberen in de lijst" });
    if (closedYears.includes(d.year) && d.informer_status !== "sent") out.push({ id: d.id, label, reason: `Boekjaar ${d.year} is afgesloten in Informer — niet verzonden` });
    if (!d.budget_line_item_id) out.push({ id: d.id, label, reason: "Nog geen post — gebruik Indelen" });
  }
  return out;
}

export const countWithoutDossier = (rows: DeclLite[]) => rows.filter((d) => d.status !== "rejected" && !d.dossier).length;
