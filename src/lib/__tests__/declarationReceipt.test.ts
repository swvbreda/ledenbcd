import { describe, expect, it } from "vitest";
import { declTokens, matchReferenceAcross, receiptDescription, reuseMismatch, runDeclarationSync, type DeclarationStore, type InformerPort } from "../../../supabase/functions/informer-sync/declarationSync";
import { paidPreflight, runPaidBatch } from "../../../supabase/functions/informer-sync/paidPreflight";
import { expenseEntries } from "../ledger";

const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const REF = `DECL-${ID.toUpperCase()}`;
const decl = (o: any = {}) => ({ id: ID, year: 2026, status: "approved", submitted_by: "u1", board_member_id: "bm-1", board_member_name: "Test", declaration_type: "reiskosten", appointment: "Overleg", amount: 21.4, bank_account: "NL91ABNA0417164300", account_holder: "Test", expense_date: "2026-10-01", informer_status: "not_sent", informer_external_id: null, informer_doc_type: null, ...o });

function store(row: any) {
  const s: DeclarationStore = {
    async load() { return { ...row }; },
    async claim(_i, retry) { const ok = (retry ? ["not_sent", "queued", "error"] : ["not_sent", "queued"]).includes(row.informer_status) && row.status === "approved"; if (ok) row.informer_status = "sending"; return ok; },
    async markSent(_i, id, type) { row.informer_status = "sent"; row.informer_external_id = id; row.informer_doc_type = type; },
    async markError() { if (row.informer_status === "sending") row.informer_status = "error"; },
    async markInvalid() { row.informer_status = "error"; }, async recordTodo() {}, async resolveTodo() {},
  };
  return s;
}
// Fake Informer: bonnetjes zoals GET /receipts ze teruggeeft (description bevat het kenmerk).
function informer(opts: { invoices?: any[]; receipts?: any[] } = {}) {
  const invoices = opts.invoices ?? [], receipts = opts.receipts ?? [];
  const calls = { receiptPost: 0 };
  const list = () => [
    ...invoices.map((i) => ({ id: i.id, type: "purchase_invoice" as const, ref: [i.number], amount: i.amount, date: i.date })),
    ...receipts.map((r) => ({ id: r.id, type: "receipt" as const, ref: declTokens(r.description), amount: r.amount, date: r.date })),
  ];
  const port: InformerPort = {
    async findByReference(ref) { const h = matchReferenceAcross(ref, list()); return h ? { id: h.id, type: h.type, amount: h.amount, date: h.date } : null; },
    async createReceipt(d, ref) { calls.receiptPost++; const r = { id: "R" + (receipts.length + 1), date: d.expense_date, payment_type: "bank", amount: d.amount, description: receiptDescription(d, ref) }; receipts.push(r); return r.id; },
  };
  return { port, calls, receipts };
}

describe("goedgekeurde declaratie -> bonnetje (Uitgaven)", () => {
  it("maakt één bonnetje met kenmerk, betaalwijze bank, en slaat soort receipt op", async () => {
    const row = decl(); const inf = informer();
    const r = await runDeclarationSync(ID, { retry: false }, store(row), inf.port);
    expect(r.success).toBe(true);
    expect(inf.calls.receiptPost).toBe(1);
    expect(inf.receipts[0]).toMatchObject({ payment_type: "bank", amount: 21.4, date: "2026-10-01" });
    expect(declTokens(inf.receipts[0].description)).toEqual([REF]);
    expect(row).toMatchObject({ informer_status: "sent", informer_external_id: "R1", informer_doc_type: "receipt" });
  });
  it("ingediend/concept/afgewezen: nul Informer-aanroepen, ook bij retry", async () => {
    for (const status of ["pending", "concept", "rejected"]) {
      const inf = informer();
      const r = await runDeclarationSync(ID, { retry: true }, store(decl({ status, informer_status: "error" })), inf.port);
      expect(r.success).toBe(false);
      expect(inf.calls.receiptPost).toBe(0);
    }
  });
  it("bestaande inkoopfactuur met kenmerk: hergebruik als purchase_invoice, geen bonnetje-POST", async () => {
    const row = decl(); const inf = informer({ invoices: [{ id: "16893353", number: REF, amount: 21.4, date: "2026-10-01" }] });
    const r = await runDeclarationSync(ID, { retry: false }, store(row), inf.port);
    expect(r.details.reused_existing).toBe(true);
    expect(inf.calls.receiptPost).toBe(0);
    expect(row.informer_doc_type).toBe("purchase_invoice");
  });
  it("al verzonden inkoopfactuur: niets opgezocht of aangemaakt", async () => {
    const inf = informer();
    const r = await runDeclarationSync(ID, { retry: true }, store(decl({ informer_status: "sent", informer_external_id: "16891019", informer_doc_type: "purchase_invoice" })), inf.port);
    expect(r.details.already_synced).toBe(true);
    expect(inf.calls.receiptPost).toBe(0);
  });
  it("kenmerk in factuur én bonnetje: ambigu, blokkeren zonder POST", async () => {
    const row = decl(); const inf = informer({ invoices: [{ id: "5", number: REF, amount: 21.4, date: "2026-10-01" }], receipts: [{ id: "5", description: `${REF} x`, amount: 21.4, date: "2026-10-01" }] });
    const r = await runDeclarationSync(ID, { retry: false }, store(row), inf.port);
    expect(r.success).toBe(false);
    expect(r.error_message).toMatch(/Meerdere/);
    expect(inf.calls.receiptPost).toBe(0);
    expect(row.informer_external_id).toBeNull();
  });
  it("gevonden document met ander bedrag, datum of soort: niet hergebruiken", () => {
    expect(reuseMismatch(decl(), { id: "1", type: "receipt", amount: 20, date: "2026-10-01" })).toMatch(/bedrag/);
    expect(reuseMismatch(decl(), { id: "1", type: "receipt", amount: 21.4, date: "2026-09-01" })).toMatch(/datum/);
    expect(reuseMismatch(decl({ informer_external_id: "1", informer_doc_type: "purchase_invoice" }), { id: "1", type: "receipt" })).toMatch(/wijkt af/);
  });
  it("lokaal document-id maar remote niets: geen nieuw bonnetje", async () => {
    const inf = informer();
    const r = await runDeclarationSync(ID, { retry: true }, store(decl({ informer_status: "error", informer_external_id: "77", informer_doc_type: "receipt" })), inf.port);
    expect(r.success).toBe(false);
    expect(inf.calls.receiptPost).toBe(0);
  });
  it("kenmerk-herkenning: alleen exacte UUID-vorm", () => {
    expect(declTokens(`x ${REF.toLowerCase()} y`)).toEqual([REF]);
    expect(declTokens("DECL-123")).toEqual([]);
  });
});

describe("betaalde batch met bonnetjes", () => {
  const paid = decl({ amount: 210, expense_date: "2026-05-31", paid_at: "2026-06-02", bank_transaction_id: "tx1" });
  const tx = [{ id: "tx1", amount: -210, value_date: "2026-06-02" }];
  it("POST ok, markSent time-out → onzeker; verse controle vindt bonnetje → hergebruik zonder 2e POST, betaling behouden", async () => {
    const row: any = { ...paid }; const inf = informer();
    const s = store(row); let fail = true;
    const flaky: DeclarationStore = { ...s, async markSent(i, id, t) { if (fail) { fail = false; throw new Error("timeout"); } return s.markSent(i, id, t); } };
    const asList = () => inf.receipts.map((r) => ({ id: r.id, number: declTokens(r.description)[0], total: r.amount, date: r.date, paid: 0, type: "receipt" as const }));
    const run = () => runPaidBatch({ requested: [ID], rows: paidPreflight([row], tx, asList()), decls: [row], closedYears: [2025], store: flaky, informer: inf.port, snapshot: async () => true });
    expect((await run()).results[0].outcome).toBe("uncertain");
    expect((await run()).results[0].outcome).toBe("reused");
    expect(inf.calls.receiptPost).toBe(1);
    expect(row).toMatchObject({ paid_at: "2026-06-02", bank_transaction_id: "tx1", informer_doc_type: "receipt", informer_external_id: "R1" });
  });
  it("verwerkt-bedrag van bonnetje is alleen informatief", () => {
    const r = paidPreflight([{ ...paid }], tx, [{ id: "R9", number: REF, total: 210, date: "2026-05-31", paid: 210, type: "receipt" }])[0];
    expect(r).toMatchObject({ status: "herstel_bestaand_document", informer_type: "receipt", informer_paid: 210 });
  });
});

describe("begroting telt bonnetjes als uitgave", () => {
  it("receipt en purchase_invoice tellen; verkoop niet", () => {
    const e = (doc_type: string, informer_id: string) => ({ doc_type, informer_id, amount_incl: 10, status: "open", deleted_at: null, excluded: false, counts_in_totals: true, dossier: null } as any);
    expect(expenseEntries([e("receipt", "1"), e("purchase_invoice", "1"), e("sales_invoice", "2")]).map((x) => x.doc_type)).toEqual(["receipt", "purchase_invoice"]);
  });
});
