// Alleen-lezen controle voor reeds betaalde declaraties vóór eventuele opname in Informer.
// Informer v2 API (officiële api-docs.json) heeft geen endpoint om een bestaande
// bankmutatie/betaling aan een inkoopfactuur te koppelen; afletteren gebeurt in Informer zelf.
// Deze controle boekt daarom niets en geeft alleen per declaratie een status terug.

export type PaidDecl = { id: string; amount: number; expense_date: string; bank_transaction_id: string | null; paid_at: string | null; informer_external_id: string | null };
export type BankTx = { id: string; amount: number; value_date: string | null };
export type InformerPurchase = { id: string; number: string; total: number | null; date: string | null; paid: number | null };

export type PreflightRow = {
  declaration_id: string;
  reference: string;
  status: "al_in_informer" | "dubbele_referentie" | "geen_bankbewijs" | "bedrag_wijkt_af" | "klaar_voor_handmatige_aflettering";
  informer_id?: string;
  informer_paid?: number | null;
};

export const declarationReference = (id: string) => `DECL-${id.toUpperCase()}`;

export function paidPreflight(decls: PaidDecl[], bank: BankTx[], purchases: InformerPurchase[]): PreflightRow[] {
  const bankById = new Map(bank.map((b) => [b.id, b]));
  return decls.map((d) => {
    const reference = declarationReference(d.id);
    const hits = purchases.filter((p) => p.number === reference);
    if (hits.length > 1) return { declaration_id: d.id, reference, status: "dubbele_referentie" };
    if (hits.length === 1 || d.informer_external_id)
      return { declaration_id: d.id, reference, status: "al_in_informer", informer_id: hits[0]?.id ?? d.informer_external_id ?? undefined, informer_paid: hits[0]?.paid ?? null };
    const tx = d.bank_transaction_id ? bankById.get(d.bank_transaction_id) : undefined;
    if (!d.paid_at || !tx) return { declaration_id: d.id, reference, status: "geen_bankbewijs" };
    if (Math.round(Math.abs(tx.amount) * 100) !== Math.round(Math.abs(d.amount) * 100))
      return { declaration_id: d.id, reference, status: "bedrag_wijkt_af" };
    return { declaration_id: d.id, reference, status: "klaar_voor_handmatige_aflettering" };
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

/** Alleen expliciet gevraagde ids die NU live "klaar voor handmatige aflettering" zijn én verder kloppen. */
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
    if (r.status !== "klaar_voor_handmatige_aflettering") { block(`Actuele controle: ${r.status}`); continue; }
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
