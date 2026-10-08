import { describe, expect, it } from "vitest";
import {
  declarationLineDescription,
  declarationReference,
  extractLedgerOptions,
  runDeclarationSync,
  selectDeclarationLedger,
  validateDeclarationForInformer,
  type DeclarationStore,
  type InformerPort,
} from "../../../supabase/functions/informer-sync/declarationSync";

const OPTIONS = { ledgers: [
  { id: 15391211, number: "4009", description: "Vrijwilligersvergoedingen" },
  { id: 15391231, number: "4495", description: "Kilometervergoeding" },
  { id: 15391263, number: "5010", description: "Reiskosten" },
] };

const month = (over: Record<string, unknown> = {}) => ({
  id: "aaaaaaaa-2222-3333-4444-555555555555", status: "approved", board_member_id: "bm", amount: 210,
  bank_account: "NL91ABNA0417164300", account_holder: "X", appointment: null, receipt_paths: [],
  declaration_type: "penningmeester", expense_date: "2025-03-31", informer_status: "not_sent", ...over,
});

describe("maandelijkse vrijwilligersvergoeding", () => {
  it("penningmeester en woordvoering -> 4009 / 15391211", () => {
    expect(selectDeclarationLedger("penningmeester", extractLedgerOptions(OPTIONS))).toBe(15391211);
    expect(selectDeclarationLedger("woordvoering", extractLedgerOptions(OPTIONS))).toBe(15391211);
  });
  it("km blijft 4495 en overig 5010", () => {
    expect(selectDeclarationLedger("reiskosten", extractLedgerOptions(OPTIONS))).toBe(15391231);
    expect(selectDeclarationLedger("overig", extractLedgerOptions(OPTIONS))).toBe(15391263);
  });
  it("afwijkende rekening onder id 15391211 blokkeert", () => {
    const bad = { ledgers: [{ id: 15391211, number: "4990", description: "Overige algemene kosten" }] };
    expect(() => selectDeclarationLedger("penningmeester", extractLedgerOptions(bad))).toThrow();
  });
  it("geen bon of omschrijving nodig, wel bestuurslid, bedrag en maand", () => {
    expect(validateDeclarationForInformer(month())).toBeNull();
    expect(validateDeclarationForInformer(month({ board_member_id: null }))).toBe("Bestuurslid ontbreekt");
    expect(validateDeclarationForInformer(month({ amount: 0 }))).toBe("Bedrag ontbreekt");
    expect(validateDeclarationForInformer(month({ expense_date: null }))).toMatch(/Maand/);
  });
  it("overig zonder bon blijft geweigerd", () => {
    expect(validateDeclarationForInformer(month({ declaration_type: "overig", appointment: "OV" }))).toMatch(/Bon/);
  });
  it("omschrijving bevat maand en vaste referentie", () => {
    const d = declarationLineDescription(month(), null);
    expect(d).toContain("maand 2025-03");
    expect(d).toContain(declarationReference(month()));
  });
  it("bestaand document met referentie: geen tweede create bij herhaling", async () => {
    const row: any = month();
    let creates = 0;
    let existing: string | null = null;
    const store: DeclarationStore = {
      async load() { return { ...row }; },
      async claim() { if (!["not_sent", "queued", "error"].includes(row.informer_status)) return false; row.informer_status = "sending"; return true; },
      async markSent(_i, doc) { row.informer_status = "sent"; row.informer_external_id = doc; },
      async markError() { row.informer_status = "error"; },
      async markInvalid() { row.informer_status = "error"; },
      async recordTodo() {},
      async resolveTodo() {},
    };
    const port: InformerPort = {
      async findByReference() { return existing ? { id: existing, type: "receipt" as const } : null; },
      async createReceipt() { creates++; existing = "D1"; return "D1"; },
    };
    await runDeclarationSync(row.id, { retry: true }, store, port);
    await runDeclarationSync(row.id, { retry: true }, store, port);
    expect(creates).toBe(1);
    expect(row.informer_external_id).toBe("D1");
  });
});
