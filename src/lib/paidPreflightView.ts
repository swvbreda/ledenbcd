// Weergaveregels voor de alleen-lezen controle "betaalde declaraties in Informer".
export type PreflightStatus = "al_in_informer" | "dubbele_referentie" | "geen_bankbewijs" | "bedrag_wijkt_af" | "klaar_voor_handmatige_aflettering";
export type PreflightRow = { declaration_id: string; reference: string; status: PreflightStatus; informer_id?: string; informer_paid?: number | null };

export const PREFLIGHT_LABEL: Record<PreflightStatus, string> = {
  al_in_informer: "Aanwezig in Informer",
  dubbele_referentie: "Duplicaat in Informer",
  geen_bankbewijs: "Bankbewijs ontbreekt",
  bedrag_wijkt_af: "Bedragverschil",
  klaar_voor_handmatige_aflettering: "Klaar voor handmatige aflettering",
};

export type PreflightResponse = { success: boolean; checked_purchases?: number; rows?: PreflightRow[]; error?: string };

export function parsePreflight(data: unknown, error: { message?: string } | null): { ok: true; rows: PreflightRow[]; checked: number } | { ok: false; message: string } {
  if (error) return { ok: false, message: error.message?.includes("403") ? "Alleen beheerders kunnen deze controle uitvoeren." : "Controle mislukt: Informer niet bereikbaar of geen toegang." };
  const d = data as PreflightResponse | null;
  if (!d?.success || !Array.isArray(d.rows)) return { ok: false, message: d?.error ?? "Controle mislukt." };
  const valid = d.rows.filter((r) => r && typeof r.declaration_id === "string" && r.status in PREFLIGHT_LABEL);
  return { ok: true, rows: valid, checked: Number(d.checked_purchases ?? 0) };
}

export function preflightSummary(rows: PreflightRow[], amountById: Map<string, number>) {
  const out: Record<PreflightStatus, { count: number; cents: number }> = {
    al_in_informer: { count: 0, cents: 0 }, dubbele_referentie: { count: 0, cents: 0 }, geen_bankbewijs: { count: 0, cents: 0 },
    bedrag_wijkt_af: { count: 0, cents: 0 }, klaar_voor_handmatige_aflettering: { count: 0, cents: 0 },
  };
  for (const r of rows) {
    out[r.status].count++;
    out[r.status].cents += Math.round((amountById.get(r.declaration_id) ?? 0) * 100);
  }
  return out;
}

export type BookResult = { declaration_id: string; reference: string; success: boolean; outcome: "created" | "reused" | "failed"; informer_document_id: string | null; error: string | null; bank_transaction_id: string | null; bank_date: string | null; bank_amount: number | null; paid_preserved: boolean };
export type BookResponse = { success: boolean; created?: number; reused?: number; failed?: number; results?: BookResult[]; blocked?: { declaration_id: string; reason: string }[]; error?: string };

export function parseBook(data: unknown, error: { message?: string } | null): { ok: true; results: BookResult[]; blocked: { declaration_id: string; reason: string }[] } | { ok: false; message: string } {
  if (error) return { ok: false, message: error.message?.includes("403") ? "Alleen beheerders kunnen dit uitvoeren." : "Opnemen mislukt: Informer niet bereikbaar of geen toegang. Er is niets als betaald geboekt." };
  const d = data as BookResponse | null;
  if (!d?.success || !Array.isArray(d.results)) return { ok: false, message: d?.error ?? "Opnemen mislukt." };
  return { ok: true, results: d.results, blocked: d.blocked ?? [] };
}
