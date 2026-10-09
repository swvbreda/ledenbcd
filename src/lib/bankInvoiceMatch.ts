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

export interface InvoiceRef {
  doc_type: string;
  informer_id: string;
  invoice_number: string | null;
  amount_incl: number;
  year: number;
  deleted_at?: string | null;
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
}

const MIN_REF_LEN = 4;

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

const sameAmount = (a: number, b: number) => Math.abs(Math.abs(a) - Math.abs(b)) < 0.005;
const isExpense = (t: string) => t === "purchase_invoice" || t === "receipt";

/**
 * Bepaalt per bankmutatie de uitkomst. Kandidaten zijn ALLE documenten met
 * exact hetzelfde genormaliseerde factuurnummer, ook al gekoppelde, zodat
 * dubbelzinnigheid nooit verborgen blijft.
 */
export function matchBankToInvoices(
  txs: BankTx[],
  invoices: InvoiceRef[],
  links: ExistingLink[],
  year: number,
): MatchResult[] {
  const byRef = new Map<string, InvoiceRef[]>();
  for (const inv of invoices) {
    if (inv.deleted_at) continue;
    const n = normalizeRef(inv.invoice_number);
    if (n.length < MIN_REF_LEN) continue;
    (byRef.get(n) ?? byRef.set(n, []).get(n)!).push(inv);
  }
  const linkedTx = new Set(links.map((l) => l.ponto_transaction_id));
  const linkedInvoice = new Map(links.map((l) => [`${l.doc_type}:${l.informer_id}`, l.ponto_transaction_id]));

  const first: MatchResult[] = txs.map((tx) => {
    const tokens = textTokens(`${tx.remittance_info ?? ""} ${tx.description ?? ""}`);
    const refs = [...tokens].filter((t) => byRef.has(t));
    const candidates = refs.flatMap((r) => byRef.get(r)!);
    if (linkedTx.has(tx.id)) return { tx, outcome: "linked_already", candidates };
    if (refs.length === 0) return { tx, outcome: "no_reference", candidates };
    if (refs.length > 1) return { tx, outcome: "multi_invoice", candidates };
    if (candidates.length > 1) return { tx, outcome: "ambiguous_invoice", candidates };
    const inv = candidates[0]!;
    const out = Number(tx.amount) < 0;
    if (out !== isExpense(inv.doc_type)) return { tx, outcome: "refund", invoice: inv, candidates };
    const txYear = tx.executed_at ? Number(String(tx.executed_at).slice(0, 4)) : NaN;
    if (inv.year !== year || txYear !== year) return { tx, outcome: "other_year", invoice: inv, candidates };
    if (!sameAmount(tx.amount, inv.amount_incl)) return { tx, outcome: "split_or_partial", invoice: inv, candidates };
    const other = linkedInvoice.get(`${inv.doc_type}:${inv.informer_id}`);
    if (other && other !== tx.id) return { tx, outcome: "invoice_already_paid_by_other", invoice: inv, candidates };
    return { tx, outcome: "match", invoice: inv, candidates };
  });

  // Twee nieuwe mutaties voor dezelfde factuur: geen van beide automatisch koppelen.
  const count = new Map<string, number>();
  for (const r of first) if (r.outcome === "match") {
    const k = `${r.invoice!.doc_type}:${r.invoice!.informer_id}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return first.map((r) =>
    r.outcome === "match" && (count.get(`${r.invoice!.doc_type}:${r.invoice!.informer_id}`) ?? 0) > 1
      ? { ...r, outcome: "duplicate_payment" as const }
      : r,
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
