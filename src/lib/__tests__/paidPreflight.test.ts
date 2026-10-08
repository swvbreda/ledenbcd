import { describe, expect, it } from "vitest";
import { paidPreflight, selectPaidBatch, closedYearsFromErrors, runPaidBatch, PAID_BATCH_MAX, type BatchDecl } from "../../../supabase/functions/informer-sync/paidPreflight";
import type { DeclarationStore, InformerPort } from "../../../supabase/functions/informer-sync/declarationSync";

const d = (id: string, extra: any = {}) => ({ id, amount: 210, expense_date: "2026-05-31", bank_transaction_id: "tx-" + id, paid_at: "2026-06-02", informer_external_id: null, ...extra });
const tx = (id: string, extra: any = {}) => ({ id: "tx-" + id, amount: -210, value_date: "2026-06-02", ...extra });
const inv = (id: string, extra: any = {}) => ({ id: "9", number: "DECL-" + id.toUpperCase(), total: 210, date: "2026-05-31", paid: 0, ...extra });

describe("paidPreflight (alleen lezen)", () => {
  it("lokaal al gekoppeld: rapporteren, nooit herstel/aanmaak", () => {
    expect(paidPreflight([d("a", { informer_external_id: "7" })], [tx("a")], [inv("a")])[0]).toMatchObject({ status: "al_in_informer", informer_id: "7" });
  });
  it("exact één remote treffer, lokaal geen id, bedrag/datum passend: herstel", () => {
    expect(paidPreflight([d("a")], [tx("a")], [inv("a")])[0]).toMatchObject({ status: "herstel_bestaand_document", informer_id: "9" });
  });
  it("remote bedrag of datum wijkt af: geblokkeerd", () => {
    expect(paidPreflight([d("a")], [tx("a")], [inv("a", { total: 200 })])[0].status).toBe("informer_bedrag_wijkt_af");
    expect(paidPreflight([d("a")], [tx("a")], [inv("a", { date: "2026-01-01" })])[0].status).toBe("informer_bedrag_wijkt_af");
  });
  it("dubbele referentie blokkeert", () => {
    expect(paidPreflight([d("a")], [tx("a")], [inv("a"), inv("a", { id: "10" })])[0].status).toBe("dubbele_referentie");
  });
  it("bankbewijs: ontbrekend, inkomend, gedeeld, bedrag of datum afwijkend", () => {
    expect(paidPreflight([d("a", { bank_transaction_id: null })], [], [])[0].status).toBe("geen_bankbewijs");
    expect(paidPreflight([d("a")], [tx("a", { amount: 210 })], [])[0].status).toBe("bank_niet_uitgaand");
    expect(paidPreflight([d("a")], [tx("a")], [], new Map([["tx-a", 2]]))[0].status).toBe("bankregel_gedeeld");
    expect(paidPreflight([d("a")], [tx("a", { amount: -200 })], [])[0].status).toBe("bedrag_wijkt_af");
    expect(paidPreflight([d("a")], [tx("a", { value_date: "2026-06-03" })], [])[0].status).toBe("bankdatum_wijkt_af");
  });
  it("uniek uitgaand exact bankbewijs zonder remote: klaar", () => {
    expect(paidPreflight([d("a")], [tx("a")], [], new Map([["tx-a", 1]]))[0].status).toBe("klaar_voor_handmatige_aflettering");
  });
});

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
  it("herstel toegestaan; al_in_informer en dubbel nooit", () => {
    const rows = [{ declaration_id: "h", reference: "", status: "herstel_bestaand_document" as const }, { declaration_id: "s", reference: "", status: "al_in_informer" as const }, { declaration_id: "x", reference: "", status: "dubbele_referentie" as const }];
    expect(selectPaidBatch(["h", "s", "x"], rows, [dd("h", { informer_status: "error" }), dd("s"), dd("x")], []).eligible).toEqual(["h"]);
  });
  it("gesloten jaar blokkeert; leeg of te groot verzoek levert niets", () => {
    expect(selectPaidBatch(["c"], [ready("c")], [dd("c", { expense_date: "2025-05-01", year: 2025 })], [2025]).eligible).toEqual([]);
    expect(selectPaidBatch([], [], [], []).eligible).toEqual([]);
    const many = Array.from({ length: PAID_BATCH_MAX + 1 }, (_, i) => "i" + i);
    expect(selectPaidBatch(many, many.map(ready), many.map((i) => dd(i)), []).eligible).toEqual([]);
  });
  it("gesloten jaren uit echte Informer-weigering", () => {
    expect(closedYearsFromErrors([{ sanitized_error: "You can no longer book in the specified period.", year: 2025 }, { sanitized_error: "x", year: 2026 }])).toEqual([2025]);
  });
});

describe("runPaidBatch end-to-end: timeout na aanmaak → herstel zonder tweede POST", () => {
  it("POST slaagt, markSent time-out → onzeker; verse controle vindt document → hergebruikt, 1 POST", async () => {
    const decl: any = { ...d("a"), status: "approved", year: 2026, informer_status: "not_sent", declaration_type: "penningmeester", board_member_id: "b", board_member_name: "B", bank_account: "NL00", account_holder: "B" };
    const remote: any[] = [];
    let posts = 0, failSent = true;
    const store: DeclarationStore = {
      load: async () => ({ ...decl }),
      claim: async (_id, retry) => { const ok = (retry ? ["not_sent", "queued", "error"] : ["not_sent", "queued"]).includes(decl.informer_status); if (ok) decl.informer_status = "sending"; return ok; },
      markSent: async (_id, doc) => { if (failSent) { failSent = false; throw new Error("timeout"); } decl.informer_status = "sent"; decl.informer_external_id = doc; },
      markError: async () => { if (decl.informer_status === "sending") decl.informer_status = "error"; },
      markInvalid: async () => {}, recordTodo: async () => {}, resolveTodo: async () => {},
    };
    const informer: InformerPort = {
      findByReference: async (ref) => remote.find((p) => p.number === ref)?.id ?? null,
      createPurchase: async (_x, ref) => { posts++; remote.push(inv("a", { id: "D1", number: ref })); return "D1"; },
    };
    const snap = async () => true;
    const check = () => paidPreflight([decl], [tx("a")], remote, new Map([["tx-a", 1]]));

    const r1 = await runPaidBatch({ requested: ["a"], rows: check(), decls: [decl as BatchDecl], closedYears: [], store, informer, snapshot: snap });
    expect(r1.results[0]).toMatchObject({ outcome: "uncertain", recheck_required: true });
    expect(decl.informer_status).toBe("error");
    expect(decl.informer_external_id).toBeNull();

    const rows2 = check();
    expect(rows2[0].status).toBe("herstel_bestaand_document");
    const r2 = await runPaidBatch({ requested: ["a"], rows: rows2, decls: [decl as BatchDecl], closedYears: [], store, informer, snapshot: snap });
    expect(r2.results[0]).toMatchObject({ outcome: "reused", success: true });
    expect(decl.informer_external_id).toBe("D1");
    expect(posts).toBe(1);
    expect(decl.paid_at).toBe("2026-06-02");
    expect(decl.bank_transaction_id).toBe("tx-a");

    // Derde run: lokaal gekoppeld → overgeslagen, geen POST
    const r3 = await runPaidBatch({ requested: ["a"], rows: check(), decls: [decl as BatchDecl], closedYears: [], store, informer, snapshot: snap });
    expect(r3.results).toEqual([]);
    expect(posts).toBe(1);
  });
  it("remote bedrag wijkt af na timeout → geblokkeerd, geen POST", async () => {
    const decl: any = { ...d("a"), status: "approved", year: 2026, informer_status: "error" };
    const rows = paidPreflight([decl], [tx("a")], [inv("a", { total: 999 })], new Map([["tx-a", 1]]));
    let posts = 0;
    const r = await runPaidBatch({ requested: ["a"], rows, decls: [decl], closedYears: [], snapshot: async () => true,
      store: {} as any, informer: { findByReference: async () => null, createPurchase: async () => { posts++; return "x"; } } });
    expect(r.results).toEqual([]);
    expect(r.blocked[0].reason).toMatch(/informer_bedrag_wijkt_af/);
    expect(posts).toBe(0);
  });
});
