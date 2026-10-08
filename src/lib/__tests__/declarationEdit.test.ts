import { describe, expect, it } from "vitest";
import { buildEditPatch, canEditDeclaration, validateEditAmount } from "../declarationEdit";

const base = { status: "pending", submitted_by: "u1", paid_at: null, bank_transaction_id: null, informer_external_id: null, informer_status: "not_sent" };
const me = { isAdmin: false, userId: "u1" }, admin = { isAdmin: true, userId: "a1" };

describe("canEditDeclaration", () => {
  it("eigen concept en pending mag, approved alleen admin", () => {
    expect(canEditDeclaration({ ...base, status: "concept" }, me).ok).toBe(true);
    expect(canEditDeclaration(base, me).ok).toBe(true);
    expect(canEditDeclaration({ ...base, status: "approved" }, me).ok).toBe(false);
    expect(canEditDeclaration({ ...base, status: "approved" }, admin).ok).toBe(true);
  });
  it("andermans declaratie niet voor gewone gebruiker", () => {
    expect(canEditDeclaration({ ...base, submitted_by: "u2" }, me).ok).toBe(false);
  });
  it("geblokkeerd bij betaald, bankbetaling, Informer-document, sending/sent/synced en afgewezen, ook voor admin", () => {
    for (const extra of [{ paid_at: "2026-01-01" }, { bank_transaction_id: "t1" }, { informer_external_id: "16891019" },
      { informer_status: "sending" }, { informer_status: "sent" }, { informer_status: "synced" }, { informer_status: "queued" }, { status: "rejected" }])
      expect(canEditDeclaration({ ...base, ...extra }, admin).ok).toBe(false);
  });
  it("informer-fout blijft wijzigbaar", () => {
    expect(canEditDeclaration({ ...base, informer_status: "error" }, me).ok).toBe(true);
  });
});

describe("buildEditPatch", () => {
  const fields: any = { board_member_id: "b1", board_member_name: "S", declaration_type: "reiskosten", appointment: "x", trajectory: null,
    km_single: 93, km_return: 186, km_rate: 0.23, amount: 42.78, expense_date: "2026-08-25", bank_account: "NL", account_holder: "S", event_id: null };
  it("bewaart bestaande bon zonder nieuwe upload", () => {
    expect(buildEditPatch(fields, ["a.pdf"], [])).toMatchObject({ receipt_paths: ["a.pdf"], receipt_path: "a.pdf" });
  });
  it("voegt nieuwe bon toe naast bestaande", () => {
    expect(buildEditPatch(fields, ["a.pdf"], ["b.pdf"]).receipt_paths).toEqual(["a.pdf", "b.pdf"]);
  });
  it("raakt status, betaal- en Informer-velden niet aan", () => {
    const p: any = buildEditPatch(fields, [], []);
    for (const k of ["status", "paid_at", "bank_transaction_id", "informer_status", "informer_external_id", "reviewed_by", "submitted_by", "id"]) expect(k in p).toBe(false);
  });
});

describe("validateEditAmount", () => {
  it("nul geweigerd bij pending/approved, toegestaan bij concept", () => {
    expect(validateEditAmount(0, "approved")).not.toBeNull();
    expect(validateEditAmount(0, "pending")).not.toBeNull();
    expect(validateEditAmount(0, "concept")).toBeNull();
    expect(validateEditAmount(42.78, "approved")).toBeNull();
  });
});
