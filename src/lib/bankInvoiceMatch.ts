// Koppeling bankmutatie (Ponto) -> Informer-document als betaalbewijs.
// Pure functies. Een koppeling verandert nooit de betaalstatus: die komt uitsluitend uit Informer.
// Bankmutaties zijn nooit extra kosten naast een factuur.

export interface BankTx {
  id: string;
  executed_at: string | null;
  amount: number;
  remittance_info?: string | null;
  description?: string | null;
}

export interface ContributionAlias {
  /** Genormaliseerd volledig, geverifieerd contributienummer. */
  ref: string;
  contribution_id: string;
}

export interface InvoiceRef {
  doc_type: string;
  informer_id: string;
  invoice_number: string | null;
  amount_incl: number;
  year: number;
  deleted_at?: string | null;
  /** Extra referenties uit geverifieerde contributies; invoice_number blijft ongewijzigd. */
  aliases?: ContributionAlias[];
}

export interface ExistingLink {
  doc_type: string;
  informer_id: string;
  ponto_transaction_id: string;
}

export type MatchOutcome =
  | "linked_already"
  | "match"
  | "no_reference"
  | "ambiguous_invoice"
  | "multi_invoice"
  | "split_or_partial"
  | "refund"
  | "other_year"
  | "invoice_already_paid_by_other"
  | "duplicate_payment";

export interface MatchResult {
  tx: BankTx;
  outcome: MatchOutcome;
  invoice?: InvoiceRef;
  candidates: InvoiceRef[];
  /** Kenmerken die nummerbegrensd in de bankomschrijving gevonden zijn. */
  matchedRefs?: string[];
  /** Contributie-aliassen waarop de match berust; vlak vóór schrijven opnieuw controleren. */
  viaAliases?: ContributionAlias[];
}

const MIN_REF_LEN = 4;
export const MIN_ALIAS_LEN = 5;

export function normalizeRef(v: string | null | undefined): string {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Tokens uit omschrijving; scheidingstekens binnen een kenmerk (- / .) blijven samen. */
export function textTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of String(text ?? "").split(/[\s,;:()"']+/)) {
    const n = normalizeRef(raw);
    if (n.length >= MIN_REF_LEN) out.add(n);
  }
  return out;
}

/**
 * Maskeert herkenbare bankmetadata vóór kenmerkmatching: datum/tijd van
 * pinbetalingen (21.09.26/13:25, 21.09.2026 13:25), losse datums/tijden, IBAN,
 * BIC en PAS/NR/TERM-codes. Masker '|' is geen toegestaan scheidingsteken, dus
 * tekens aan weerszijden kunnen nooit tot één kenmerk samensmelten.
 */
export function maskBankMetadata(text: string | null | undefined): string {
  return String(text ?? "")
    .toUpperCase()
    .replace(/(?<![A-Z0-9])\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}(?:[ /T]+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)?(?![A-Z0-9])/g, "|")
    .replace(/(?<![A-Z0-9])\d{1,2}:\d{2}(?::\d{2})?(?![A-Z0-9])/g, "|")
    .replace(/(?<![A-Z0-9])[A-Z]{2}\d{2}[A-Z]{4}\d{7,}(?![A-Z0-9])/g, "|")
    .replace(/\bBIC\s*[:.]?\s*[A-Z0-9]{8,11}(?![A-Z0-9])/g, "|")
    .replace(/(?<![A-Z0-9])PAS\d{2,4}(?![A-Z0-9])/g, "|")
    // Terminalcodes (NR:C487Z9) bevatten letters én cijfers; 'Factuur nr:202607' blijft.
    .replace(/\b(?:NR|TERM|TERMINAL)\s*[:.]\s*(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]+/g, "|");
}

const refRegexCache = new Map<string, RegExp>();
/**
 * Nummerbegrensd zoeken in de originele omschrijving. Tussen tekens van het kenmerk
 * mag één spatie/streep/punt/slash staan ('202 6002'); direct ervoor en erna mag geen
 * letter of cijfer staan, zodat een deel van een langer kenmerk of IBAN nooit matcht.
 */
export function containsRef(text: string, ref: string): boolean {
  if (ref.length < MIN_REF_LEN || !/^[A-Z0-9]+$/.test(ref)) return false;
  let re = refRegexCache.get(ref);
  if (!re) {
    // Numeriek begin/eind: geen los fragment van 1-3 cijfers achter/voor één
    // scheidingsteken, zodat '202607' niet als prefix van '202607 1' (= 2026071)
    // matcht; twee volwaardige losse nummers ('F-023 2026023') blijven werken.
    const pre = /^[0-9]/.test(ref) ? "(?<![A-Z0-9])(?<!(?<![A-Z0-9 \\-./])[0-9]{1,3}[ \\-./])" : "(?<![A-Z0-9])";
    const post = /[0-9]$/.test(ref) ? "(?![A-Z0-9])(?![ \\-./][0-9]{1,3}(?![A-Z0-9]))" : "(?![A-Z0-9])";
    re = new RegExp(`${pre}${ref.split("").join("[ \\-./]?")}${post}`);
    refRegexCache.set(ref, re);
  }
  return re.test(maskBankMetadata(text));
}

export interface AliasContribution {
  id: string;
  year: number;
  amount: number;
  invoice_number: string | null;
  external_invoice_id: string | null;
}

/** Controle per alias: contributie wijst uniek naar dit document en jaar/bedrag kloppen. */
export function aliasStillValid(inv: InvoiceRef, alias: ContributionAlias, c: AliasContribution | null | undefined): boolean {
  if (!c || c.id !== alias.contribution_id) return false;
  return inv.doc_type === "sales_invoice" && !inv.deleted_at
    && String(c.external_invoice_id ?? "") === inv.informer_id
    && normalizeRef(c.invoice_number) === alias.ref && alias.ref.length >= MIN_ALIAS_LEN
    && c.year === inv.year && sameAmount(Number(c.amount), Number(inv.amount_incl));
}

/**
 * Aliassen: alleen een geverifieerd volledig contributienummer (≥5 tekens) bij een
 * bestaand verkoopdocument waarvan external_invoice_id, jaar en bedrag uniek kloppen.
 * Nooit een jaarprefix verzinnen; invoice_number van het document blijft zoals het is.
 */
export function withContributionAliases<T extends InvoiceRef>(invoices: T[], contributions: AliasContribution[]): T[] {
  const byExt = new Map<string, AliasContribution[]>();
  for (const c of contributions) {
    if (!c.external_invoice_id) continue;
    const k = String(c.external_invoice_id);
    (byExt.get(k) ?? byExt.set(k, []).get(k)!).push(c);
  }
  const salesCount = new Map<string, number>();
  for (const i of invoices) if (i.doc_type === "sales_invoice" && !i.deleted_at) salesCount.set(i.informer_id, (salesCount.get(i.informer_id) ?? 0) + 1);
  return invoices.map((inv) => {
    if (inv.doc_type !== "sales_invoice" || inv.deleted_at || salesCount.get(inv.informer_id) !== 1) return inv;
    const cs = byExt.get(inv.informer_id) ?? [];
    if (cs.length !== 1) return inv;
    const c = cs[0]!;
    const alias = { ref: normalizeRef(c.invoice_number), contribution_id: c.id };
    if (!aliasStillValid(inv, alias, c) || alias.ref === normalizeRef(inv.invoice_number)) return inv;
    return { ...inv, aliases: [...(inv.aliases ?? []), alias] };
  });
}

const sameAmount = (a: number, b: number) => Math.abs(Math.abs(a) - Math.abs(b)) < 0.005;
const isExpense = (t: string) => t === "purchase_invoice" || t === "receipt";
const docKey = (i: { doc_type: string; informer_id: string }) => `${i.doc_type}:${i.informer_id}`;

/**
 * Bepaalt per bankmutatie de uitkomst. Kandidaten zijn ALLE documenten met
 * exact hetzelfde genormaliseerde factuurnummer of alias, ook al gekoppelde en
 * uit andere jaren, zodat dubbelzinnigheid nooit verborgen blijft. Hetzelfde
 * document via twee kenmerken telt als één document.
 */
export function matchBankToInvoices(
  txs: BankTx[],
  invoices: InvoiceRef[],
  links: ExistingLink[],
  year: number,
): MatchResult[] {
  const byRef = new Map<string, Map<string, { inv: InvoiceRef; alias?: ContributionAlias }>>();
  const add = (ref: string, inv: InvoiceRef, alias?: ContributionAlias) => {
    const m = byRef.get(ref) ?? byRef.set(ref, new Map()).get(ref)!;
    const prev = m.get(docKey(inv));
    if (!prev || (prev.alias && !alias)) m.set(docKey(inv), { inv, alias });
  };
  for (const inv of invoices) {
    if (inv.deleted_at) continue;
    const n = normalizeRef(inv.invoice_number);
    if (n.length >= MIN_REF_LEN) add(n, inv);
    for (const a of inv.aliases ?? []) if (a.ref.length >= MIN_ALIAS_LEN) add(a.ref, inv, a);
  }
  const allRefs = [...byRef.keys()];
  const linkedTx = new Set(links.map((l) => l.ponto_transaction_id));
  const linkedInvoice = new Map(links.map((l) => [docKey(l), l.ponto_transaction_id]));

  const first: MatchResult[] = txs.map((tx) => {
    const text = `${tx.remittance_info ?? ""} ${tx.description ?? ""}`;
    const refs = allRefs.filter((r) => containsRef(text, r));
    const docs = new Map<string, InvoiceRef>();
    const viaAliases: ContributionAlias[] = [];
    let ambiguous = false;
    for (const r of refs) {
      const m = byRef.get(r)!;
      if (m.size > 1) ambiguous = true;
      for (const [k, v] of m) {
        docs.set(k, v.inv);
        if (v.alias) viaAliases.push(v.alias);
      }
    }
    const candidates = [...docs.values()];
    const base = { tx, candidates, matchedRefs: refs };
    if (linkedTx.has(tx.id)) return { ...base, outcome: "linked_already" as const };
    if (candidates.length === 0) return { ...base, outcome: "no_reference" as const };
    if (ambiguous) return { ...base, outcome: "ambiguous_invoice" as const };
    if (candidates.length > 1) return { ...base, outcome: "multi_invoice" as const };
    const inv = candidates[0]!;
    // Alias alleen nodig als het eigen nummer niet gevonden is; anders niet afhankelijk.
    const ownFound = refs.includes(normalizeRef(inv.invoice_number));
    const b = { ...base, invoice: inv, viaAliases: ownFound ? [] : viaAliases };
    // Creditfacturen (negatief bedrag) en terugbetalingen nooit als gewone betaling.
    if (Number(inv.amount_incl) < 0) return { ...b, outcome: "refund" as const };
    const out = Number(tx.amount) < 0;
    if (out !== isExpense(inv.doc_type)) return { ...b, outcome: "refund" as const };
    const txYear = tx.executed_at ? Number(String(tx.executed_at).slice(0, 4)) : NaN;
    if (inv.year !== year || txYear !== year) return { ...b, outcome: "other_year" as const };
    if (!sameAmount(tx.amount, inv.amount_incl)) return { ...b, outcome: "split_or_partial" as const };
    const other = linkedInvoice.get(docKey(inv));
    if (other && other !== tx.id) return { ...b, outcome: "invoice_already_paid_by_other" as const };
    return { ...b, outcome: "match" as const };
  });

  // Twee nieuwe mutaties voor dezelfde factuur: geen van beide automatisch koppelen.
  const count = new Map<string, number>();
  for (const r of first) if (r.outcome === "match") count.set(docKey(r.invoice!), (count.get(docKey(r.invoice!)) ?? 0) + 1);
  return first.map((r) =>
    r.outcome === "match" && (count.get(docKey(r.invoice!)) ?? 0) > 1 ? { ...r, outcome: "duplicate_payment" as const } : r,
  );
}

export const OUTCOME_LABEL: Record<MatchOutcome, string> = {
  linked_already: "Al gekoppeld",
  match: "Eenduidig te koppelen",
  no_reference: "Geen factuurnummer in omschrijving",
  ambiguous_invoice: "Factuurnummer komt bij meerdere documenten voor",
  multi_invoice: "Meerdere factuurnummers in één betaling",
  split_or_partial: "Bedrag wijkt af (deel- of samengestelde betaling)",
  refund: "Richting klopt niet (terugbetaling/creditering)",
  other_year: "Ander boekjaar",
  invoice_already_paid_by_other: "Factuur al aan andere betaling gekoppeld",
  duplicate_payment: "Meerdere betalingen voor dezelfde factuur",
};

export interface WritableBankLink {
  doc_type: string;
  informer_id: string;
  ponto_transaction_id: string;
}

/**
 * Te schrijven koppelingen uit een VERS berekend plan. Alleen 'match'; een
 * oud plan mag nooit worden gebruikt (bron kan tussen plan en sync wijzigen).
 */
export function writableBankLinks(fresh: MatchResult[]): WritableBankLink[] {
  return fresh
    .filter((r) => r.outcome === "match" && r.invoice && !r.invoice.deleted_at)
    .map((r) => ({ doc_type: r.invoice!.doc_type, informer_id: r.invoice!.informer_id, ponto_transaction_id: r.tx.id }));
}

/**
 * Laatste controle vlak vóór schrijven met opnieuw gelezen gegevens: factuur,
 * huidige bankmutatie (bedrag/richting/jaar) en elke contributie-alias waarop de
 * match berust. Bestaande koppelingen (ook concurrent handmatig) blokkeren.
 */
export function prewriteOk(args: {
  planned: MatchResult;
  year: number;
  invoice: { amount_incl: number | string; year: number; deleted_at: string | null } | null;
  tx: { amount: number | string; executed_at: string | null } | null;
  existingLinks: number;
  aliasContributions: Array<AliasContribution | null>;
}): boolean {
  const { planned, year, invoice, tx, existingLinks, aliasContributions } = args;
  const inv = planned.invoice;
  if (!inv || !invoice || !tx || existingLinks > 0 || invoice.deleted_at || invoice.year !== year) return false;
  const amt = Number(tx.amount);
  if (!sameAmount(amt, Number(planned.tx.amount)) || Math.sign(amt) !== Math.sign(Number(planned.tx.amount))) return false;
  if (Number(String(tx.executed_at ?? "").slice(0, 4)) !== year) return false;
  if ((amt < 0) !== isExpense(inv.doc_type) || Number(invoice.amount_incl) < 0) return false;
  if (!sameAmount(Number(invoice.amount_incl), amt)) return false;
  const aliases = planned.viaAliases ?? [];
  if (aliasContributions.length !== aliases.length) return false;
  return aliases.every((a, i) => aliasStillValid({ ...inv, amount_incl: Number(invoice.amount_incl), year: invoice.year, deleted_at: invoice.deleted_at }, a, aliasContributions[i]));
}
