// Regels voor het wijzigen van een bestaande declaratie (zelfde id, zelfde Informer-referentie).
export type EditableInput = {
  status: string;
  submitted_by: string | null;
  paid_at: string | null;
  bank_transaction_id?: string | null;
  informer_external_id: string | null;
  informer_status: string;
};

/** Informerstatussen waarbij nog niets in de boekhouding staat of bezig is. */
export const EDITABLE_INFORMER_STATUSES = ["not_sent", "error"] as const;
export const EDITABLE_STATUSES = ["concept", "pending", "approved"] as const;

export type EditCheck = { ok: true } | { ok: false; reason: string };

export function canEditDeclaration(d: EditableInput, opts: { isAdmin: boolean; userId: string }): EditCheck {
  if (d.paid_at || d.bank_transaction_id) return { ok: false, reason: "Deze declaratie is al betaald en kan niet meer worden gewijzigd." };
  if (d.informer_external_id || !(EDITABLE_INFORMER_STATUSES as readonly string[]).includes(d.informer_status))
    return { ok: false, reason: "Deze declaratie staat al in Informer of wordt nu verstuurd. Wijzigen kan alleen via de administratie in Informer." };
  if (!(EDITABLE_STATUSES as readonly string[]).includes(d.status)) return { ok: false, reason: "Afgewezen declaraties kunnen niet worden gewijzigd." };
  if (opts.isAdmin) return { ok: true };
  if (d.submitted_by !== opts.userId) return { ok: false, reason: "Je kunt alleen je eigen declaraties wijzigen." };
  if (d.status === "approved") return { ok: false, reason: "Een goedgekeurde declaratie kan alleen de administratie nog wijzigen." };
  return { ok: true };
}

export type DeclarationEditFields = {
  board_member_id: string;
  board_member_name: string;
  declaration_type: string;
  appointment: string;
  trajectory: string | null;
  km_single: number | null;
  km_return: number | null;
  km_rate: number;
  amount: number;
  expense_date: string;
  bank_account: string;
  account_holder: string;
  event_id: string | null;
};

/** Alleen inhoudsvelden; status, goedkeuring, betaling en Informer-velden blijven buiten de wijziging. */
export function buildEditPatch(fields: DeclarationEditFields, existingReceipts: string[], newReceipts: string[]) {
  const receipt_paths = [...existingReceipts, ...newReceipts];
  return { ...fields, receipt_paths, receipt_path: receipt_paths[0] ?? null };
}

/** Bedrag moet positief zijn, behalve bij opslaan als concept. */
export function validateEditAmount(amount: number, status: string): string | null {
  if (status === "concept") return amount < 0 ? "Het bedrag kan niet negatief zijn" : null;
  return amount > 0 ? null : "Het bedrag moet groter dan € 0 zijn";
}
