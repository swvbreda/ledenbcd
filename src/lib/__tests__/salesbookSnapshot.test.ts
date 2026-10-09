import { describe, expect, it } from "vitest";
import { isSourceSnapshotId } from "../../../supabase/functions/informer-sync/ledgerImport";
import { isSourceSnapshotId as uiSnapshot } from "../ledgerSource";
import { planMemberLinks } from "../memberInvoiceLink";

describe("bronsnapshot salesbook", () => {
  it("salesbook-id is bronsnapshot (sync slaat over), numeriek API-id niet", () => {
    expect(isSourceSnapshotId("salesbook:abc-95")).toBe(true);
    expect(isSourceSnapshotId("14269063")).toBe(false);
    expect(uiSnapshot("salesbook:abc")).toBe(true);
  });
  const e = (o: any = {}) => ({ informer_id: "salesbook:x", invoice_number: "95", amount_incl: 3000, year: 2026, relation_id: null, relation_name: "Huzur", ...o });
  const c = (o: any = {}) => ({ id: "c1", member_id: 33, year: 2026, amount: 3000, invoice_number: "2026095", external_invoice_id: null, ...o });
  it("kort label 95 wordt niet blind 2026095", () => {
    expect(planMemberLinks([e({ relation_name: null })], [c()], [], 2026)[0].outcome).toBe("unmatched");
  });
  it("unieke naam + bedrag + jaar = voorstel", () => {
    expect(planMemberLinks([e()], [c()], [], 2026, new Map([[33, "Huzur"]]))[0].outcome).toBe("propose");
  });
  it("naam bij twee leden = conflict", () => {
    expect(planMemberLinks([e()], [c()], [], 2026, new Map([[33, "Huzur"], [34, "Huzur"]]))[0].outcome).toBe("conflict");
  });
  it("naam past maar bedrag wijkt af = conflict", () => {
    expect(planMemberLinks([e({ amount_incl: 1500 })], [c()], [], 2026, new Map([[33, "Huzur"]]))[0].outcome).toBe("conflict");
  });
  it("twee documenten voor één contributie = conflict", () => {
    const r = planMemberLinks([e(), e({ informer_id: "salesbook:y" })], [c()], [], 2026, new Map([[33, "Huzur"]]));
    expect(r.map((x) => x.outcome)).toEqual(["conflict", "conflict"]);
  });
});
