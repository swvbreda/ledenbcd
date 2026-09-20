import { describe, expect, it } from "vitest";
import {
  assertOverrideSaved,
  classifyRowId,
  entryKeyFromRowId,
  entryKeyVariants,
  isLedgerEntryKey,
  ledgerEntryKey,
  parseLedgerEntryKey,
  parseLedgerRowId,
} from "./ledgerRowId";

describe("parseLedgerRowId", () => {
  it("houdt het informer_id intact", () => {
    expect(parseLedgerRowId("ledger:purchase_invoice:20260688")).toEqual({
      doc_type: "purchase_invoice",
      informer_id: "20260688",
    });
  });

  it("verliest geen informer_id met dubbele punten", () => {
    expect(parseLedgerRowId("ledger:sales_invoice:2026:0003")).toEqual({
      doc_type: "sales_invoice",
      informer_id: "2026:0003",
    });
  });

  it("negeert niet-ledger id's", () => {
    expect(parseLedgerRowId("ponto:abc")).toBeNull();
    expect(parseLedgerRowId("ledger:purchase_invoice")).toBeNull();
  });
});

describe("classifyRowId", () => {
  it("routeert per bron", () => {
    expect(classifyRowId("ledger:purchase_invoice:1")).toEqual({
      kind: "ledger",
      ref: { doc_type: "purchase_invoice", informer_id: "1" },
    });
    expect(classifyRowId("ponto:abc-def")).toEqual({ kind: "ponto", id: "abc-def" });
    expect(classifyRowId("bank:xyz")).toEqual({ kind: "bank", id: "xyz" });
    expect(classifyRowId("contrib:12")).toEqual({ kind: "contrib" });
    expect(classifyRowId("plain-uuid")).toEqual({ kind: "expense", id: "plain-uuid" });
  });

  it("splitst een ledger-id niet meer verkeerd tot alleen het doc_type", () => {
    const t = classifyRowId("ledger:purchase_invoice:20260688");
    expect(t.kind).toBe("ledger");
    expect(t.kind === "ledger" && t.ref.informer_id).toBe("20260688");
  });
});

describe("entryKeyFromRowId", () => {
  it("geeft de canonieke sleutel zonder UI-prefix", () => {
    expect(entryKeyFromRowId("ledger:purchase_invoice:20260688")).toBe(
      "purchase_invoice:20260688",
    );
    expect(entryKeyFromRowId("ponto:1")).toBe("ponto:1");
    expect(entryKeyFromRowId("expense-id")).toBe("expense:expense-id");
    expect(entryKeyFromRowId("contrib:1")).toBeNull();
  });
});

describe("assertOverrideSaved", () => {
  const ref = { doc_type: "purchase_invoice", informer_id: "20260688" };

  it("faalt wanneer nul rijen zijn geschreven", () => {
    expect(() => assertOverrideSaved([], ref)).toThrow(/purchase_invoice:20260688/);
    expect(() => assertOverrideSaved(null, ref)).toThrow();
  });

  it("slaagt met een teruggegeven rij", () => {
    expect(() => assertOverrideSaved([{ id: "1" }], ref)).not.toThrow();
  });
});

describe("ledgerEntryKey", () => {
  it("bouwt de sleutel", () => {
    expect(ledgerEntryKey({ doc_type: "sales_invoice", informer_id: "9" })).toBe(
      "sales_invoice:9",
    );
  });
});

describe("canonieke dossiersleutels", () => {
  it("parseert canonieke en oude geprefixte sleutels", () => {
    expect(parseLedgerEntryKey("purchase_invoice:123")).toEqual({
      doc_type: "purchase_invoice",
      informer_id: "123",
    });
    expect(parseLedgerEntryKey("ledger:purchase_invoice:123")).toEqual({
      doc_type: "purchase_invoice",
      informer_id: "123",
    });
    expect(parseLedgerEntryKey("expense:ledger:purchase_invoice:123")).toEqual({
      doc_type: "purchase_invoice",
      informer_id: "123",
    });
  });

  it("behoudt een informer_id met dubbele punten", () => {
    expect(parseLedgerEntryKey("sales_invoice:a:b:c")).toEqual({
      doc_type: "sales_invoice",
      informer_id: "a:b:c",
    });
    expect(entryKeyVariants("ledger:sales_invoice:a:b:c")).toEqual([
      "sales_invoice:a:b:c",
      "ledger:sales_invoice:a:b:c",
      "expense:ledger:sales_invoice:a:b:c",
    ]);
  });

  it("dezelfde sleutel als ExpenseDialog gebruikt voor splits en documenten", () => {
    const rowId = "ledger:purchase_invoice:20260688";
    expect(entryKeyFromRowId(rowId)).toBe("purchase_invoice:20260688");
    expect(entryKeyVariants(entryKeyFromRowId(rowId)!)).toContain(rowId);
  });

  it("laat niet-ledger sleutels ongemoeid", () => {
    expect(isLedgerEntryKey("ponto:abc")).toBe(false);
    expect(entryKeyVariants("ponto:abc")).toEqual(["ponto:abc"]);
    expect(entryKeyVariants("expense:xyz")).toEqual(["expense:xyz"]);
  });
});
