import { describe, expect, it } from "vitest";
import { paidPreflight } from "../../../supabase/functions/informer-sync/paidPreflight";

const d = (id: string, extra: any = {}) => ({ id, amount: 210, expense_date: "2026-05-31", bank_transaction_id: "tx-" + id, paid_at: "2026-06-02", informer_external_id: null, ...extra });
const bank = [{ id: "tx-a", amount: -210, value_date: "2026-06-02" }, { id: "tx-b", amount: -200, value_date: null }, { id: "tx-c", amount: -210, value_date: null }];

describe("paidPreflight (alleen lezen)", () => {
  it("bestaande referentie in Informer: niet opnieuw aanmaken", () => {
    const r = paidPreflight([d("a")], bank, [{ id: "9", number: "DECL-A", total: 210, date: null, paid: 210 }]);
    expect(r[0]).toMatchObject({ status: "al_in_informer", informer_id: "9", informer_paid: 210 });
  });
  it("dubbele referentie blokkeert", () => {
    const p = { id: "1", number: "DECL-A", total: 210, date: null, paid: 0 };
    expect(paidPreflight([d("a")], bank, [p, { ...p, id: "2" }])[0].status).toBe("dubbele_referentie");
  });
  it("zonder bankbewijs of met afwijkend bedrag nooit klaar", () => {
    expect(paidPreflight([d("x", { bank_transaction_id: null })], bank, [])[0].status).toBe("geen_bankbewijs");
    expect(paidPreflight([d("b")], bank, [])[0].status).toBe("bedrag_wijkt_af");
  });
  it("exact bedrag + bestaande bankmutatie: klaar voor handmatige aflettering, bank-id ongewijzigd", () => {
    const before = JSON.stringify(bank);
    expect(paidPreflight([d("c")], bank, [])[0].status).toBe("klaar_voor_handmatige_aflettering");
    expect(JSON.stringify(bank)).toBe(before);
  });
});
