import { describe, expect, it } from "vitest";
import {
  extractLedgerOptions,
  runDeclarationSync,
  selectDeclarationLedger,
  validateDeclarationForInformer,
  type DeclarationStore,
  type InformerPort,
} from "../../../supabase/functions/informer-sync/declarationSync";

const OPTIONS = {
  ledgers: [
    { id: 15391256, number: "4009", description: "Vrijwilligersvergoedingen" },
    { id: 15391231, number: "4495", description: "Kilometervergoeding" },
    { id: 15391263, number: "5010", description: "Reiskosten" },
  ],
};

const decl = (over: Record<string, unknown> = {}) => ({
  id: "11111111-2222-3333-4444-555555555555", status: "pending", board_member_id: "bm", amount: 12,
  bank_account: "NL91ABNA0417164300", account_holder: "X", appointment: "Vergadering",
  declaration_type: "reiskosten", receipt_path: "bon.pdf", informer_status: "not_sent", ...over,
});

describe("grootboekkeuze declaraties", () => {
  it("kilometerdeclaratie (reiskosten) -> 4495 / 15391231", () => {
    expect(selectDeclarationLedger("reiskosten", extractLedgerOptions(OPTIONS))).toBe(15391231);
  });

  it("overig (overige reiskosten) -> 5010 / 15391263", () => {
    expect(selectDeclarationLedger("overig", extractLedgerOptions(OPTIONS))).toBe(15391263);
  });

  it("opties als object op id worden ook herkend", () => {
    const body = { ledgers: { "15391231": { number: "4495", description: "Kilometervergoeding" } } };
    expect(selectDeclarationLedger("reiskosten", extractLedgerOptions(body))).toBe(15391231);
  });

  it("onbekende soort wordt geblokkeerd; reiskosten en overig zijn geldig", () => {
    expect(() => selectDeclarationLedger("iets", extractLedgerOptions(OPTIONS))).toThrow(/Geen grootboekrekening/);
    expect(validateDeclarationForInformer(decl({ declaration_type: "iets" }))).toMatch(/Onbekende declaratiesoort/);
    expect(validateDeclarationForInformer(decl({ declaration_type: "overige_reiskosten" }))).toMatch(/Onbekende declaratiesoort/);
    expect(validateDeclarationForInformer(decl({ declaration_type: "overig" }))).toBeNull();
    expect(validateDeclarationForInformer(decl({ declaration_type: "reiskosten" }))).toBeNull();
  });

  it("geen fallback naar eerste rekening als de afgesproken rekening ontbreekt", () => {
    const body = { ledgers: [{ id: 15391256, number: "4009", description: "Vrijwilligersvergoedingen" }] };
    expect(() => selectDeclarationLedger("reiskosten", extractLedgerOptions(body))).toThrow(/niet gevonden/);
    expect(() => selectDeclarationLedger("reiskosten", [])).toThrow(/niet gevonden/);
  });

  it("afwijkende code bij hetzelfde id blokkeert", () => {
    const body = { ledgers: [{ id: 15391231, number: "4009", description: "Vrijwilligersvergoedingen" }] };
    expect(() => selectDeclarationLedger("reiskosten", extractLedgerOptions(body))).toThrow(/verwacht 4495/);
  });

  it("onbekende soort: geen claim en geen Informer-aanroep", async () => {
    let calls = 0; let claimed = false;
    const store: DeclarationStore = {
      async load() { return decl({ declaration_type: "iets" }); },
      async claim() { claimed = true; return true; },
      async markSent() {}, async markError() {}, async markInvalid() {}, async recordTodo() {}, async resolveTodo() {},
    };
    const port: InformerPort = {
      async findByReference() { calls++; return null; },
      async createReceipt() { calls++; return "X"; },
    };
    const r = await runDeclarationSync("id", { retry: false }, store, port);
    expect(r.success).toBe(false);
    expect(claimed).toBe(false);
    expect(calls).toBe(0);
  });
});
