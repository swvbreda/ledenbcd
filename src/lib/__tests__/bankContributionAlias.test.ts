import { describe, expect, it } from "vitest";
import { matchBankToInvoices, withContributionAliases, writableBankLinks, prewriteOk, containsRef, type InvoiceRef } from "../bankInvoiceMatch";

const doc = (o: Partial<InvoiceRef> = {}): InvoiceRef => ({ doc_type: "sales_invoice", informer_id: "salesbook:7nC205WL", invoice_number: "023", amount_incl: 3000, year: 2026, ...o });
const contrib = (o: any = {}) => ({ id: "c23", year: 2026, amount: 3000, invoice_number: "2026023", external_invoice_id: "salesbook:7nC205WL", ...o });
const tx = (o: any = {}) => ({ id: "t1", executed_at: "2026-02-10T10:00:00Z", amount: 3000, remittance_info: "2026023/Othala BV", ...o });
const run = (docs: InvoiceRef[], cs: any[], txs = [tx()], links: any[] = []) => matchBankToInvoices(txs, withContributionAliases(docs, cs), links, 2026);

describe("geverifieerde contributienummers als alias", () => {
  it("geldige alias: Othala 2026023/Othala BV koppelt aan salesbook-document", () => {
    const r = run([doc()], [contrib()])[0];
    expect(r.outcome).toBe("match");
    expect(r.invoice!.informer_id).toBe("salesbook:7nC205WL");
    expect(r.invoice!.invoice_number).toBe("023"); // nooit overschreven
    expect(r.viaAliases).toEqual([{ ref: "2026023", contribution_id: "c23" }]);
  });
  it("onbekend external ID: geen alias, geen match", () => {
    expect(run([doc()], [contrib({ external_invoice_id: "999" })])[0].outcome).toBe("no_reference");
  });
  it("bedrag of jaar wijkt af: geen alias", () => {
    expect(run([doc()], [contrib({ amount: 2500 })])[0].outcome).toBe("no_reference");
    expect(run([doc()], [contrib({ year: 2025 })])[0].outcome).toBe("no_reference");
  });
  it("korter dan 5 tekens: geen alias", () => {
    expect(run([doc()], [contrib({ invoice_number: "2023" })], [tx({ remittance_info: "2023 Othala" })])[0].outcome).toBe("no_reference");
  });
  it("twee contributies met hetzelfde external ID: geen alias", () => {
    expect(run([doc()], [contrib(), contrib({ id: "c99" })])[0].outcome).toBe("no_reference");
  });
  it("hetzelfde document via eigen nummer én alias: geen valse multi_invoice", () => {
    const r = run([doc({ invoice_number: "F-023" })], [contrib()], [tx({ remittance_info: "F-023 2026023" })])[0];
    expect(r.outcome).toBe("match");
    expect(r.viaAliases).toEqual([]);
  });
  it("alias gelijk aan nummer van ander document (ook ander jaar/al gekoppeld): ambigu", () => {
    const other = doc({ doc_type: "sales_invoice", informer_id: "555", invoice_number: "2026023", year: 2025 });
    const r = run([doc(), other], [contrib()], [tx()], [{ doc_type: "sales_invoice", informer_id: "555", ponto_transaction_id: "tx-x" }])[0];
    expect(r.outcome).toBe("ambiguous_invoice");
    expect(writableBankLinks([r])).toEqual([]);
  });
  it("ingebed in langer kenmerk of IBAN: geen match", () => {
    expect(run([doc()], [contrib()], [tx({ remittance_info: "NL12BANK20260230 Othala" })])[0].outcome).toBe("no_reference");
    expect(run([doc()], [contrib()], [tx({ remittance_info: "X2026023 Othala" })])[0].outcome).toBe("no_reference");
    expect(run([doc()], [contrib()], [tx({ remittance_info: "20260231" })])[0].outcome).toBe("no_reference");
  });
  it("spatie/streep/punt/slash binnen nummer toegestaan", () => {
    expect(containsRef("contributie 202 6002", "2026002")).toBe(true);
    expect(containsRef("2026-023", "2026023")).toBe(true);
    expect(containsRef("2026.023", "2026023")).toBe(true);
    expect(containsRef("2026/023/Othala", "2026023")).toBe(true);
    expect(containsRef("2026  023", "2026023")).toBe(false);
  });
  it("split, verkeerde richting, credit en twee betalingen: niet koppelen", () => {
    expect(run([doc()], [contrib()], [tx({ amount: 1500 })])[0].outcome).toBe("split_or_partial");
    expect(run([doc()], [contrib()], [tx({ amount: -3000 })])[0].outcome).toBe("refund");
    expect(run([doc()], [contrib()], [tx(), tx({ id: "t2" })]).map((r) => r.outcome)).toEqual(["duplicate_payment", "duplicate_payment"]);
  });
});

describe("controle vlak vóór schrijven", () => {
  const planned = run([doc()], [contrib()])[0];
  const base = { planned, year: 2026, invoice: { amount_incl: 3000, year: 2026, deleted_at: null }, tx: { amount: 3000, executed_at: "2026-02-10" }, existingLinks: 0, aliasContributions: [contrib()] };
  it("alles ongewijzigd: schrijven mag", () => expect(prewriteOk(base)).toBe(true));
  it("bankmutatiebedrag intussen gewijzigd: niet schrijven", () => expect(prewriteOk({ ...base, tx: { amount: 2999, executed_at: "2026-02-10" } })).toBe(false));
  it("bankmutatie richting omgedraaid: niet schrijven", () => expect(prewriteOk({ ...base, tx: { amount: -3000, executed_at: "2026-02-10" } })).toBe(false));
  it("bankmutatie naar ander jaar: niet schrijven", () => expect(prewriteOk({ ...base, tx: { amount: 3000, executed_at: "2025-12-31" } })).toBe(false));
  it("alias-contributie intussen omgekoppeld: niet schrijven", () => expect(prewriteOk({ ...base, aliasContributions: [contrib({ external_invoice_id: "x" })] })).toBe(false));
  it("alias-contributie verwijderd: niet schrijven", () => expect(prewriteOk({ ...base, aliasContributions: [null] })).toBe(false));
  it("concurrente koppeling: behouden, niet schrijven", () => expect(prewriteOk({ ...base, existingLinks: 1 })).toBe(false));
});
