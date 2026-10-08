// Pure regels voor het admin-paneel "Nog te beoordelen". Leest alleen; wijzigt niets.

export type Contribution = { id: string; member_id: number; year: number; amount: number; paid: boolean; external_invoice_id: string | null };
export type ContributionReview = { id: string; member_id: number; name: string; year: number; amount: number; reason: string };

export type BankTag = { dossier: string | null; year: number; incoming: boolean };

/** Lidnummers met exacte "(#lidnummer)"-tag op een INKOMENDE bankontvangst in precies dat jaar. */
export function taggedMembers(bank: BankTag[], year: number): Set<number> {
  const tagged = new Set<number>();
  for (const b of bank) {
    if (!b.incoming || b.year !== year) continue;
    for (const m of String(b.dossier ?? "").matchAll(/\(#(\d+)\)/g)) tagged.add(Number(m[1]));
  }
  return tagged;
}

/** Betaalde contributies zonder Informer-factuur én zonder bankontvangst met "(#lidnummer)" in hetzelfde jaar. */
export function contributionsToReview(rows: Contribution[], bank: BankTag[], names: Map<number, string>, year: number): ContributionReview[] {
  const tagged = taggedMembers(bank, year);
  return rows
    .filter((c) => c.year === year && c.paid && !c.external_invoice_id && !tagged.has(c.member_id))
    .map((c) => ({ id: c.id, member_id: c.member_id, name: names.get(c.member_id) ?? `Lid ${c.member_id}`, year: c.year, amount: Number(c.amount),
      reason: `Geen Informer-factuur en geen bankontvangst in ${year} met dit lidnummer in het dossier` }))
    .sort((a, b) => a.member_id - b.member_id);
}

/** Afgesloten boekjaren volgens echte Informer-weigeringen ("can no longer book in the specified period"). */
export function closedYearsFromAttempts(attempts: { sanitized_error: string | null; year: number }[]): number[] {
  return [...new Set(attempts.filter((a) => /no longer book in the specified period/i.test(a.sanitized_error ?? "")).map((a) => a.year))].sort();
}

/** Rekening → bedoelde post (naam), volgens de keuzes van de administratie. */
export const ACCOUNT_POST_RULES: { prefix: string; post: string }[] = [
  { prefix: "4009", post: "Onkosten vergoedingen" },
  { prefix: "4495", post: "Reiskosten" },
  { prefix: "5010", post: "Reiskosten" },
  { prefix: "4340", post: "Juridische kosten / bestuurlijk advies" },
  { prefix: "4350", post: "Administratiekosten / accountantskosten" },
];
export const intendedPost = (account: string | null) => ACCOUNT_POST_RULES.find((r) => String(account ?? "").startsWith(r.prefix))?.post ?? null;

export type LedgerRow = { informer_id: string; ledger_account: string | null; amount_incl: number | null; relation_name: string | null; entry_date: string | null };
export type LedgerException = LedgerRow & { intended: string; currentPost: string; currentPostId: string | null; manual: boolean; dossier: string | null };

/** Boekingen waarvan de werkelijke post (handmatige override, anders eerdere toewijzing) afwijkt van de rekeningregel: alleen tonen, nooit overschrijven. */
export function ledgerExceptions(rows: LedgerRow[], overrideLineItem: Map<string, string | null>, legacyPost: Map<string, { id: string | null; name: string }>, dossier: Map<string, string | null>, itemName: Map<string, string>): LedgerException[] {
  const out: LedgerException[] = [];
  for (const r of rows) {
    const intended = intendedPost(r.ledger_account);
    if (!intended) continue;
    const ov = overrideLineItem.get(r.informer_id);
    const cur = ov ? { id: ov, name: itemName.get(ov) ?? "Onbekende post" } : legacyPost.get(r.informer_id);
    if (cur && !cur.name.startsWith(intended)) out.push({ ...r, intended, currentPost: cur.name, currentPostId: cur.id, manual: !!ov, dossier: dossier.get(r.informer_id) ?? null });
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
    if (declYearMismatch(d)) out.push({ id: d.id, label, reason: `Opgeslagen jaar ${d.year} wijkt af van uitgavedatum ${d.expense_date} — niet aangepast` });
    if (!d.budget_line_item_id) out.push({ id: d.id, label, reason: "Nog geen post — gebruik Indelen" });
  }
  return out;
}

export const countWithoutDossier = (rows: DeclLite[]) => rows.filter((d) => d.status !== "rejected" && !d.dossier).length;

export type BankIn = { id: string; amount: number; year: number; dossier: string | null; invoice_reference?: string | null; declLinked?: boolean };
export type EvidenceRow = { contribution_id: string; member_id: number; amount: number; bank_ids: string[]; bank_total: number; reason: string };

/** Bewijs per contributie: alleen "bewezen" bij vastgelegde koppeling naar 1 unieke ontvangst met exact bedrag; al het andere is een uitzondering. */
export function contributionEvidence(rows: Contribution[], bank: BankIn[], links: { contribution_id: string; bank_transaction_id: string }[], year: number) {
  const byMember = new Map<number, BankIn[]>();
  const tagCount = new Map<string, number>();
  for (const b of bank) {
    if (b.year !== year || Number(b.amount) <= 0) continue;
    const ids = new Set([...String(b.dossier ?? "").matchAll(/\(#(\d+)\)/g)].map((m) => Number(m[1])));
    tagCount.set(b.id, ids.size);
    for (const id of ids) byMember.set(id, [...(byMember.get(id) ?? []), b]);
  }
  const linkBy = new Map(links.map((l) => [l.contribution_id, l.bank_transaction_id]));
  const linked: EvidenceRow[] = [], exceptions: EvidenceRow[] = [];
  for (const c of rows) {
    if (c.year !== year || !c.paid || c.external_invoice_id) continue;
    const tx = byMember.get(c.member_id) ?? [];
    if (!tx.length) continue; // valt onder "zonder bankdossier"
    const total = Math.round(tx.reduce((s, b) => s + Number(b.amount), 0) * 100) / 100;
    const base = { contribution_id: c.id, member_id: c.member_id, amount: Number(c.amount), bank_ids: tx.map((b) => b.id), bank_total: total };
    const lid = linkBy.get(c.id);
    const one = tx.length === 1 ? tx[0] : null;
    if (lid && one && one.id === lid && Number(one.amount) === Number(c.amount)) { linked.push({ ...base, reason: "Bewezen: 1 unieke ontvangst, exact bedrag" }); continue; }
    let reason = "Lidtag zonder vastgelegde koppeling";
    if (tx.some((b) => (tagCount.get(b.id) ?? 0) > 1)) reason = "Ontvangst noemt meerdere leden";
    else if (tx.some((b) => b.declLinked || (b.invoice_reference ?? "") !== "")) reason = "Ontvangst hoort ook bij ander document";
    else if (total > Number(c.amount)) reason = `Overbetaling: ${tx.length} ontvangsten`;
    else if (total < Number(c.amount)) reason = "Gedeeltelijk betaald volgens bank";
    exceptions.push({ ...base, reason });
  }
  return { linked, exceptions };
}

/** Opgeslagen jaar wijkt af van jaar van de uitgavedatum. */
export const declYearMismatch = (d: DeclLite) => Number(String(d.expense_date).slice(0, 4)) !== Number(d.year);
