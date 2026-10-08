// Alleen-lezen controle voor reeds betaalde declaraties vóór eventuele opname in Informer.
// Informer v2 API (officiële api-docs.json) heeft geen endpoint om een bestaande
// bankmutatie/betaling aan een inkoopfactuur te koppelen; afletteren gebeurt in Informer zelf.
// Deze controle boekt daarom niets en geeft alleen per declaratie een status terug.

export type PaidDecl = { id: string; amount: number; expense_date: string; bank_transaction_id: string | null; paid_at: string | null; informer_external_id: string | null };
export type BankTx = { id: string; amount: number; value_date: string | null };
export type InformerPurchase = { id: string; number: string; total: number | null; date: string | null; paid: number | null };

export type PreflightStatus =
  | "al_in_informer" | "dubbele_referentie" | "geen_bankbewijs" | "bedrag_wijkt_af"
  | "bank_niet_uitgaand" | "bankdatum_wijkt_af" | "bankregel_gedeeld"
  | "informer_bedrag_wijkt_af" | "herstel_bestaand_document" | "klaar_voor_handmatige_aflettering";

export type PreflightRow = {
  declaration_id: string;
  reference: string;
  status: PreflightStatus;
  informer_id?: string;
  informer_paid?: number | null;
};

export const declarationReference = (id: string) => `DECL-${id.toUpperCase()}`;
const cents = (n: unknown) => Math.round(Math.abs(Number(n)) * 100);
const day = (v: unknown) => String(v ?? "").slice(0, 10);

/**
 * bankUse: per bankregel-id het aantal declaraties (in de hele tabel) dat ernaar verwijst.
 * Zonder bankUse telt alleen de meegegeven set.
 * Bankbewijs = uitgaande bankregel (bedrag < 0), uniek aan deze declaratie, exact bedrag,
 * valutadatum gelijk aan lokale betaaldatum.
 */
export function paidPreflight(decls: PaidDecl[], bank: BankTx[], purchases: InformerPurchase[], bankUse?: Map<string, number>): PreflightRow[] {
  const bankById = new Map(bank.map((b) => [b.id, b]));
  const use = bankUse ?? decls.reduce((m, d) => (d.bank_transaction_id ? m.set(d.bank_transaction_id, (m.get(d.bank_transaction_id) ?? 0) + 1) : m), new Map<string, number>());
  return decls.map((d) => {
    const reference = declarationReference(d.id);
    const row = (status: PreflightStatus, extra: Partial<PreflightRow> = {}): PreflightRow => ({ declaration_id: d.id, reference, status, ...extra });
    const hits = purchases.filter((p) => String(p.number).trim().toUpperCase() === reference);
    if (hits.length > 1) return row("dubbele_referentie");
    // Lokaal al gekoppeld: alleen rapporteren, nooit opnieuw aanmaken of overschrijven.
    if (d.informer_external_id) return row("al_in_informer", { informer_id: d.informer_external_id, informer_paid: hits[0]?.paid ?? null });
    const tx = d.bank_transaction_id ? bankById.get(d.bank_transaction_id) : undefined;
    if (!d.paid_at || !tx) return row("geen_bankbewijs");
    if (!(Number(tx.amount) < 0)) return row("bank_niet_uitgaand");
    if ((use.get(tx.id) ?? 0) !== 1) return row("bankregel_gedeeld");
    if (cents(tx.amount) !== cents(d.amount)) return row("bedrag_wijkt_af");
    if (!tx.value_date || day(tx.value_date) !== day(d.paid_at)) return row("bankdatum_wijkt_af");
    if (hits.length === 1) {
      const h = hits[0];
      const dateOk = !h.date || day(h.date) === day(d.expense_date);
      if (h.total == null || cents(h.total) !== cents(d.amount) || !dateOk) return row("informer_bedrag_wijkt_af", { informer_id: h.id, informer_paid: h.paid });
      // Eerder (bijv. vóór een timeout) aangemaakt document met exact deze referentie: alleen hergebruiken.
      return row("herstel_bestaand_document", { informer_id: h.id, informer_paid: h.paid });
    }
    return row("klaar_voor_handmatige_aflettering");
  });
}

// ---------------------------------------------------------------------------
// Opname van reeds betaalde declaraties in Informer (admin-only batch).
// Maakt per declaratie hooguit één inkoopfactuur met de bestaande DECL-referentie.
// Raakt nooit betaalstatus, betaaldatum, bankkoppeling, bedrag, jaar, post of dossier;
// boekt geen betaling of memoriaal. Afletteren tegen de bestaande bankbetaling gebeurt handmatig.
// ---------------------------------------------------------------------------

export const PAID_BATCH_MAX = 25;
export type BatchDecl = PaidDecl & { status: string; year: number; informer_status: string };
export type BatchBlock = { declaration_id: string; reason: string };
const BATCH_OK: PreflightStatus[] = ["klaar_voor_handmatige_aflettering", "herstel_bestaand_document"];

/** Alleen expliciet gevraagde ids die NU live klaar zijn (nieuw of exact één bestaand document) én verder kloppen. */
export function selectPaidBatch(requested: string[], rows: PreflightRow[], decls: BatchDecl[], closedYears: number[]): { eligible: string[]; blocked: BatchBlock[] } {
  const ids = [...new Set((requested ?? []).map(String))];
  if (ids.length === 0) return { eligible: [], blocked: [{ declaration_id: "-", reason: "Geen declaraties gekozen" }] };
  if (ids.length > PAID_BATCH_MAX) return { eligible: [], blocked: ids.map((id) => ({ declaration_id: id, reason: `Maximaal ${PAID_BATCH_MAX} per keer` })) };
  const rowBy = new Map(rows.map((r) => [r.declaration_id, r]));
  const declBy = new Map(decls.map((d) => [d.id, d]));
  const eligible: string[] = [], blocked: BatchBlock[] = [];
  for (const id of ids) {
    const r = rowBy.get(id), d = declBy.get(id);
    const block = (reason: string) => blocked.push({ declaration_id: id, reason });
    if (!r || !d) { block("Niet gevonden in actuele controle"); continue; }
    if (!BATCH_OK.includes(r.status)) { block(`Actuele controle: ${r.status}`); continue; }
    if (d.informer_external_id) { block("Al lokaal gekoppeld aan Informer-document"); continue; }
    if (d.status !== "approved") { block("Niet goedgekeurd"); continue; }
    if (!(Number(d.amount) > 0)) { block("Bedrag ontbreekt"); continue; }
    const dateYear = Number(String(d.expense_date).slice(0, 4));
    if (dateYear !== Number(d.year)) { block("Opgeslagen jaar wijkt af van uitgavedatum"); continue; }
    if (closedYears.includes(dateYear)) { block(`Boekjaar ${dateYear} is afgesloten`); continue; }
    if (!["not_sent", "queued", "error"].includes(d.informer_status)) { block(`Informer-status ${d.informer_status}`); continue; }
    eligible.push(id);
  }
  return { eligible, blocked };
}

export function closedYearsFromErrors(errors: { sanitized_error: string | null; year: number }[]): number[] {
  return [...new Set(errors.filter((e) => /no longer book in the specified period/i.test(e.sanitized_error ?? "")).map((e) => e.year))].sort();
}
