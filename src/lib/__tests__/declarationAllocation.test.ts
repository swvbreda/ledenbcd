import { describe, expect, it } from "vitest";
import { planDeclarationAllocation } from "../declarationAllocation";

const opts = { isAdmin: true, validLineItemIds: ["onkosten", "reis"] };
describe("planDeclarationAllocation", () => {
  it("gewone gebruiker mag niet toewijzen", () => {
    expect(planDeclarationAllocation({ informer_external_id: null }, { lineItemId: "onkosten", dossier: null }, null, { ...opts, isAdmin: false }).ok).toBe(false);
  });
  it("post buiten het jaar wordt geweigerd", () => {
    expect(planDeclarationAllocation({ informer_external_id: null }, { lineItemId: "x", dossier: null }, null, opts).ok).toBe(false);
  });
  it("zonder Informer-document alleen de declaratie", () => {
    expect(planDeclarationAllocation({ informer_external_id: null }, { lineItemId: "onkosten", dossier: " Amsterdam i-criterium " }, null, opts))
      .toEqual({ ok: true, declarationPatch: { budget_line_item_id: "onkosten", dossier: "Amsterdam i-criterium" }, override: "none" });
  });
  it("met Informer-document en geen override: override op hetzelfde document", () => {
    const p: any = planDeclarationAllocation({ informer_external_id: "16891349" }, { lineItemId: "onkosten", dossier: null }, null, opts);
    expect(p.override).toBe("upsert");
    expect(p.overridePatch).toEqual({ line_item_id: "onkosten", dossier: null });
  });
  it("bestaande handmatige toewijzing wordt nooit overschreven", () => {
    expect(planDeclarationAllocation({ informer_external_id: "1" }, { lineItemId: "reis", dossier: null }, { line_item_id: "onkosten", dossier: null }, opts).ok).toBe(false);
    expect(planDeclarationAllocation({ informer_external_id: "1" }, { lineItemId: null, dossier: "B" }, { line_item_id: null, dossier: "A" }, opts).ok).toBe(false);
  });
  it("lege kant aanvullen behoudt bestaande waarde", () => {
    const p: any = planDeclarationAllocation({ informer_external_id: "1" }, { lineItemId: "onkosten", dossier: null }, { line_item_id: null, dossier: "A" }, opts);
    expect(p.overridePatch).toEqual({ line_item_id: "onkosten", dossier: "A" });
  });
  it("gelijke toewijzing laat override ongemoeid", () => {
    expect((planDeclarationAllocation({ informer_external_id: "1" }, { lineItemId: "onkosten", dossier: null }, { line_item_id: "onkosten", dossier: null }, opts) as any).override).toBe("unchanged");
  });
  it("uitgesloten document blokkeert", () => {
    expect(planDeclarationAllocation({ informer_external_id: "1" }, { lineItemId: "onkosten", dossier: null }, { line_item_id: null, dossier: null, excluded: true }, opts).ok).toBe(false);
  });
});
