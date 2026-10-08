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

import { selectPaidBatch, closedYearsFromErrors, PAID_BATCH_MAX } from "../../../supabase/functions/informer-sync/paidPreflight";
describe("selectPaidBatch", () => {
  const dd = (id: string, x: any = {}) => ({ ...d(id), status: "approved", year: 2026, informer_status: "not_sent", ...x });
  const ready = (id: string) => ({ declaration_id: id, reference: "DECL-" + id, status: "klaar_voor_handmatige_aflettering" as const });
  it("alleen expliciete, live klare, goedgekeurde, open-jaar records", () => {
    const r = selectPaidBatch(["c", "b", "z", "y", "e", "q"],
      [ready("c"), { declaration_id: "b", reference: "x", status: "bedrag_wijkt_af" }, ready("y"), ready("e"), ready("q")],
      [dd("c"), dd("b"), dd("y", { year: 2025 }), dd("e", { informer_status: "sent" }), dd("q", { status: "pending" })], [2025]);
    expect(r.eligible).toEqual(["c"]);
    expect(r.blocked.map((b) => b.declaration_id)).toEqual(["b", "z", "y", "e", "q"]);
  });
  it("gesloten jaar blokkeert; leeg of te groot verzoek levert niets", () => {
    expect(selectPaidBatch(["c"], [ready("c")], [dd("c", { expense_date: "2025-05-01", year: 2025 })], [2025]).eligible).toEqual([]);
    expect(selectPaidBatch([], [], [], []).eligible).toEqual([]);
    const many = Array.from({ length: PAID_BATCH_MAX + 1 }, (_, i) => "i" + i);
    expect(selectPaidBatch(many, many.map(ready), many.map((i) => dd(i)), []).eligible).toEqual([]);
  });
  it("dubbel id telt één keer; foutstatus mag opnieuw", () => {
    expect(selectPaidBatch(["c", "c"], [ready("c")], [dd("c", { informer_status: "error" })], []).eligible).toEqual(["c"]);
  });
  it("gesloten jaren uit echte Informer-weigering", () => {
    expect(closedYearsFromErrors([{ sanitized_error: "You can no longer book in the specified period.", year: 2025 }, { sanitized_error: "x", year: 2026 }])).toEqual([2025]);
  });
});
