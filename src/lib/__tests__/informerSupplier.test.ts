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

describe("leverancier-payload volgens officieel v2 RelationInputPrivate", () => {
  const p = buildSupplierRelationPayload(input) as Record<string, any>;

  it("bevat alleen gedocumenteerde v2-velden en alle verplichte velden", () => {
    for (const k of Object.keys(p)) expect(RELATION_INPUT_FIELDS).toContain(k);
    for (const k of ["relation_type", "street", "house_number", "zip", "city", "country", "firstname", "surname"]) {
      expect(p[k]).toBeTruthy();
    }
    expect(p).not.toHaveProperty("company_name");
    expect(p).not.toHaveProperty("phone_number");
  });

  it("relation_type integer 1, phone, subtype leverancier, land NL", () => {
    expect(p.relation_type).toBe(1);
    expect(p.phone).toBe("0612345678");
    expect(p.subtype).toEqual({ supplier: 1, active: 1 });
    expect(p.country).toBe("NL");
    expect(p.zip).toBe("1234 AB");
    expect(p.iban).toBe("NL91ABNA0417164300");
    expect(p).not.toHaveProperty("relation_number");
  });

  it("laat lege optionele velden weg", () => {
    const q = buildSupplierRelationPayload({ ...input, suffix: undefined, phone: "", surname_prefix: undefined });
    expect(q).not.toHaveProperty("house_number_suffix");
    expect(q).not.toHaveProperty("phone");
    expect(q).not.toHaveProperty("surname_prefix");
  });
});

describe("Informer 422-foutmelding voor admin (alleen veld + vaste categorie)", () => {
  const LEAKS = /Jan|Dijk|Teststraat|Kerkweg|Pietersen|NL91|example|1234|Bearer|AAAAAAAA/;

  it("v2 ValidationError: velden met categorieën", () => {
    const msg = describeInformerError(422, { error: {
      surname: "surname is verplicht.", collection_date: "moet een geldige datum zijn (Y-m-d).", relation_number: "must be integer",
    }, response_code: 422 });
    expect(msg).toBe("HTTP 422: surname: verplicht; collection_date: ongeldig formaat; relation_number: ongeldig type");
  });

  it("object-fout met straat- en persoonsnaam lekt niets", () => {
    const msg = describeInformerError(422, { error: {
      street: "Straat 'Teststraat' bestaat niet", surname: "Jan van Dijk is al bekend", iban: "NL91ABNA0417164300 ongeldig",
    } })!;
    expect(msg).not.toMatch(LEAKS);
    expect(msg).toContain("street:");
    expect(msg).toContain("iban: ongeldig formaat");
  });

  it("string- en array-fouten met namen lekken niets", () => {
    const s = describeInformerError(422, "Relatie Jan Pietersen, Kerkweg 5 bestaat al")!;
    const a = describeInformerError(422, { errors: ["Kerkweg 5 onbekend", "Bearer abc.def", "A".repeat(100), { field: "email", message: "jan@example.test ongeldig" }] })!;
    expect(s).not.toMatch(LEAKS);
    expect(a).not.toMatch(LEAKS);
    expect(s).toBe("HTTP 422: onbekend veld: afgekeurd");
    expect(a).toContain("email: ongeldig formaat");
  });

  it("onbekende veldnaam generiek; lege body geeft HTTP-status", () => {
    expect(describeInformerError(422, { error: { geheim_x: "verplicht" } })).toBe("HTTP 422: onbekend veld: verplicht");
    expect(describeInformerError(422, null)).toBe("HTTP 422");
    expect(describeInformerError(200, { success: "Relation saved" })).toBeNull();
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
    const decl = { id: "11111111-2222-3333-4444-555555555555", status: "approved", board_member_id: "bm", amount: 12,
      declaration_type: "overig", receipt_path: "r.pdf", bank_account: "NL91ABNA0417164300", account_holder: "X", appointment: "Vergadering", informer_status: "not_sent" };
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
      createReceipt: async () => { creates++; throw new Error(`Leverancier aanmaken in Informer mislukt: ${describeInformerError(422, { error: { surname: "required" } })}`); },
    });
    expect(first.success).toBe(false);
    expect(state.informer_status).toBe("error");
    expect(state.err).toContain("surname: verplicht");

    const second = await runDeclarationSync(decl.id, { retry: true }, store, {
      findByReference: async () => ({ id: "999", type: "purchase_invoice" as const }),
      createReceipt: async () => { creates++; return "x"; },
    });
    expect(second.success).toBe(true);
    expect(creates).toBe(1);
    expect(state.informer_document_id).toBe("999");
  });
});
