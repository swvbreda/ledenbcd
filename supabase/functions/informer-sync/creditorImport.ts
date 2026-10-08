// Pure regels voor de oude crediteurenimport (pull_creditors).
// Canonieke bron voor inkoopkosten is informer_ledger_entries (pull_invoices).
// Deze import maakt daarom geen nieuwe budget_expenses meer aan en wijzigt
// bestaande regels niet: een nieuwe rij zou een willekeurige begrotingspost
// moeten krijgen (kolom is verplicht) en kan dubbel tellen. Hij bewaart alleen
// nog het factuurbestand bij een al bestaande regel.

function toAmountOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Bedrag incl. btw uit een v2-inkoopfactuur; null als er geen bedrag in staat (nooit stilzwijgend 0). */
export function purchaseInvoiceAmount(inv: any): number | null {
  const direct = [inv?.totals?.incl_vat, inv?.totals?.incl_vat_default, inv?.total_price_incl_tax, inv?.total, inv?.amount];
  for (const v of direct) {
    const n = toAmountOrNull(v);
    if (n !== null) return n;
  }
  const lines = Array.isArray(inv?.lines) ? inv.lines : inv?.lines && typeof inv.lines === "object" ? Object.values(inv.lines) : [];
  if (lines.length === 0) return null;
  let sum = 0;
  for (const line of lines as any[]) {
    const n = toAmountOrNull(line?.total_incl_vat ?? line?.amount_incl ?? line?.total_price_incl_tax);
    if (n === null) return null;
    sum += n;
  }
  return Math.round(sum * 100) / 100;
}

export type CreditorPlan =
  | { kind: "skip"; reason: "geen bestaande regel" | "geen factuur-id" }
  | { kind: "store_document_only"; expenseId: string };

export function planCreditorImport(externalId: string, existing: { id: string } | null): CreditorPlan {
  if (!externalId) return { kind: "skip", reason: "geen factuur-id" };
  if (!existing?.id) return { kind: "skip", reason: "geen bestaande regel" };
  return { kind: "store_document_only", expenseId: existing.id };
}
