// Toewijzing van een declaratie aan begrotingspost en dossier (alleen admin/administratie).
// Staat de declaratie al als document in Informer, dan loopt de toewijzing ook via de
// bestaande boekhoud-override (doc_type purchase_invoice + informer_id), zodat begroting
// en dossiers dezelfde bron gebruiken. Een bestaande, afwijkende handmatige toewijzing
// wordt nooit overschreven.

export type AllocationChoice = { lineItemId: string | null; dossier: string | null };
export type ExistingOverride = { line_item_id: string | null; dossier: string | null; excluded?: boolean | null } | null;

export type AllocationPlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      declarationPatch: { budget_line_item_id: string | null; dossier: string | null };
      override: "none" | "upsert" | "unchanged";
      overridePatch?: { line_item_id: string | null; dossier: string | null };
    };

const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

export function planDeclarationAllocation(
  decl: { informer_external_id: string | null },
  choice: AllocationChoice,
  existing: ExistingOverride,
  opts: { isAdmin: boolean; validLineItemIds: string[] },
): AllocationPlan {
  if (!opts.isAdmin) return { ok: false, reason: "Alleen de administratie kan posten en dossiers toewijzen." };
  const lineItemId = choice.lineItemId || null;
  const dossier = clean(choice.dossier);
  if (lineItemId && !opts.validLineItemIds.includes(lineItemId))
    return { ok: false, reason: "Deze begrotingspost hoort niet bij het jaar van de declaratie." };
  const declarationPatch = { budget_line_item_id: lineItemId, dossier };
  if (!decl.informer_external_id) return { ok: true, declarationPatch, override: "none" };

  if (existing) {
    if (existing.excluded) return { ok: false, reason: "Dit Informer-document is in de boekhouding uitgesloten; pas dat daar aan." };
    const conflictPost = existing.line_item_id && lineItemId && existing.line_item_id !== lineItemId;
    const conflictDossier = existing.dossier && dossier && existing.dossier !== dossier;
    if (conflictPost || conflictDossier)
      return { ok: false, reason: "Het Informer-document heeft al een andere handmatige toewijzing. Pas die aan bij de boekhouding." };
    const merged = { line_item_id: existing.line_item_id ?? lineItemId, dossier: existing.dossier ?? dossier };
    const same = merged.line_item_id === existing.line_item_id && merged.dossier === existing.dossier;
    return same
      ? { ok: true, declarationPatch, override: "unchanged" }
      : { ok: true, declarationPatch, override: "upsert", overridePatch: merged };
  }
  if (!lineItemId && !dossier) return { ok: true, declarationPatch, override: "none" };
  return { ok: true, declarationPatch, override: "upsert", overridePatch: { line_item_id: lineItemId, dossier } };
}
