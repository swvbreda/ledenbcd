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
