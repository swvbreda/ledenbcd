import { describe, expect, it } from "vitest";
import {
  buildSupplierRelationPayload,
  describeInformerError,
  findExistingSupplierId,
  RELATION_INPUT_FIELDS,
  selectDeclarationLedger,
  runDeclarationSync,
  type DeclarationStore,
} from "../../../supabase/functions/informer-sync/declarationSync";

const input = {
  firstname: "Jan", surname_prefix: "van", surname: "Dijk",
  street: "Teststraat", houseNumber: "12", suffix: "A", zip: "1234 ab", city: "Utrecht",
  email: "jan@example.test", phone: "0612345678", iban: "NL91 ABNA 0417 1643 00",
};

describe("leverancier-payload volgens officieel RelationInput-schema", () => {
  const p = buildSupplierRelationPayload(input);

  it("bevat alleen gedocumenteerde velden (geen subtype/phone)", () => {
    for (const k of Object.keys(p)) expect(RELATION_INPUT_FIELDS).toContain(k);
    expect(p).not.toHaveProperty("subtype");
    expect(p).not.toHaveProperty("phone");
    expect(p.phone_number).toBe("0612345678");
  });

  it("relation_type is string '1' (privé), relation_number '0', land NL", () => {
    expect(p.relation_type).toBe("1");
    expect(p.relation_number).toBe("0");
    expect(p.country).toBe("NL");
    expect(p.zip).toBe("1234 AB");
    expect(p.iban).toBe("NL91ABNA0417164300");
  });

  it("laat lege optionele velden weg", () => {
    const q = buildSupplierRelationPayload({ ...input, suffix: undefined, phone: "", surname_prefix: undefined });
    expect(q).not.toHaveProperty("house_number_suffix");
    expect(q).not.toHaveProperty("phone_number");
    expect(q).not.toHaveProperty("surname_prefix");
  });
});

describe("Informer 422-foutmelding voor admin", () => {
  it("toont veldnamen en meldingen", () => {
    const msg = describeInformerError(422, { errors: { surname: ["is required"], country: "invalid" } });
    expect(msg).toBe("HTTP 422: surname: is required; country: invalid");
  });

  it("lekt geen IBAN, e-mail, postcode, token of base64", () => {
    const body = {
      error: [
        "iban NL91ABNA0417164300 invalid",
        "email jan@example.test exists",
        "zip 1234 AB unknown",
        "Bearer abc.def.ghi",
        "A".repeat(120),
      ],
    };
    const msg = describeInformerError(422, body)!;
    expect(msg).not.toMatch(/NL91|jan@example|1234 AB|abc\.def|AAAAAAAAAA/);
    expect(msg).toContain("[IBAN]");
    expect(msg).toContain("[EMAIL]");
  });

  it("onbekende veldnaam wordt generiek en lege body geeft HTTP-status", () => {
    expect(describeInformerError(422, { errors: { secret_x: "bad" } })).toBe("HTTP 422: veld: bad");
    expect(describeInformerError(422, null)).toBe("HTTP 422");
    expect(describeInformerError(200, { success: true })).toBeNull();
  });
});

describe("bestaande leverancier hergebruiken", () => {
  const relations = [
    { id: "77", firstname: "Piet", surname: "Jansen", email: "piet@example.test" },
    { id: "88", company_name: "Ander BV", iban: "NL91 ABNA 0417 1643 00" },
  ];
  it("match op e-mail, IBAN of naam", () => {
    expect(findExistingSupplierId(relations, { emails: ["PIET@example.test"], name: "x" })).toBe("77");
    expect(findExistingSupplierId(relations, { emails: [], iban: "nl91abna0417164300" })).toBe("88");
    expect(findExistingSupplierId(relations, { emails: [], name: "Piet Jansen" })).toBe("77");
  });
  it("geen match of lege naam geeft geen hergebruik", () => {
    expect(findExistingSupplierId(relations, { emails: [], name: "" })).toBe("");
    expect(findExistingSupplierId([{ id: "abc", name: "Piet" }], { emails: [], name: "Piet" })).toBe("");
  });
});

describe("ongewijzigd: rekeningen en idempotentie", () => {
  const opts = [
    { id: 15391231, number: "4495", description: "Kilometervergoeding" },
    { id: 15391263, number: "5010", description: "Reiskosten" },
  ];
  it("4495 en 5010 blijven", () => {
    expect(selectDeclarationLedger("reiskosten", opts)).toBe(15391231);
    expect(selectDeclarationLedger("overig", opts)).toBe(15391263);
  });

  it("422 bij leverancier: status fout, geen tweede create bij retry als document bestaat", async () => {
    const decl = { id: "11111111-2222-3333-4444-555555555555", status: "pending", board_member_id: "bm", amount: 12,
      declaration_type: "overig", receipt_path: "r.pdf", bank_account: "NL91ABNA0417164300", informer_status: "not_sent" };
    const state: any = { ...decl };
    const store: DeclarationStore = {
      load: async () => ({ ...state }),
      claim: async () => { if (state.informer_status === "sending") return false; state.informer_status = "sending"; return true; },
      markSent: async (_i, d) => { state.informer_status = "sent"; state.informer_document_id = d; },
      markError: async (_i, m) => { state.informer_status = "error"; state.err = m; },
      markInvalid: async () => {}, recordTodo: async () => {}, resolveTodo: async () => {},
    };
    let creates = 0;
    const first = await runDeclarationSync(decl.id, { retry: false }, store, {
      findByReference: async () => null,
      createPurchase: async () => { creates++; throw new Error(`Leverancier aanmaken in Informer mislukt: ${describeInformerError(422, { errors: { surname: "required" } })}`); },
    });
    expect(first.success).toBe(false);
    expect(state.informer_status).toBe("error");
    expect(state.err).toContain("surname: required");

    const second = await runDeclarationSync(decl.id, { retry: true }, store, {
      findByReference: async () => "999",
      createPurchase: async () => { creates++; return "x"; },
    });
    expect(second.success).toBe(true);
    expect(creates).toBe(1);
    expect(state.informer_document_id).toBe("999");
  });
});
