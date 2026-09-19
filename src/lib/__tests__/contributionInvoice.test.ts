import { describe, it, expect } from "vitest";
import { resolveContributionInvoice, hasCanonicalInvoice, buildCanonicalInvoiceRows, sumCanonicalInvoiceRows } from "../contributionInvoice";

describe("resolveContributionInvoice", () => {
  it("telt een lokale placeholder niet op bij een canonieke Informer-factuur", () => {
    const r = resolveContributionInvoice({
      contrib: {
        amount: 1000,
        invoice_number: "2026-0008",
        invoice_date: "2026-09-01",
        paid: true,
        paid_date: "2026-09-10",
        external_invoice_id: "inf-8",
      },
      invoices: [{ invoice_number: null, amount: 1000, invoice_date: "2026-09-01" }],
      defaultAmount: 3000,
    });
    expect(r.source).toBe("informer");
    expect(r.invoicedAmount).toBe(1000);
    expect(r.invoiceNumbers).toEqual(["2026-0008"]);
    expect(r.paidAmount).toBe(1000);
    expect(r.openAmount).toBe(0);
    expect(r.status).toBe("paid");
  });

  it("houdt een openstaande Informer-factuur op het Informer-bedrag", () => {
    const r = resolveContributionInvoice({
      contrib: {
        amount: 1000,
        invoice_number: "2026-0009",
        invoice_date: "2026-09-01",
        paid: false,
        external_invoice_id: "inf-9",
      },
      invoices: [{ invoice_number: null, amount: 1000 }],
      defaultAmount: 3000,
    });
    expect(r.invoicedAmount).toBe(1000);
    expect(r.openAmount).toBe(1000);
    expect(r.status).toBe("sent");
  });

  it("laat betalingen het Informer-factuurbedrag niet wijzigen", () => {
    const r = resolveContributionInvoice({
      contrib: { amount: 1000, invoice_number: "2026-0008", external_invoice_id: "inf-8", paid: false },
      invoices: [],
      payment: { amount: 400, paidDate: "2026-09-12" },
      defaultAmount: 3000,
    });
    expect(r.invoicedAmount).toBe(1000);
    expect(r.paidAmount).toBe(400);
    expect(r.openAmount).toBe(600);
    expect(r.paidDate).toBe("2026-09-12");
  });

  it("gebruikt de legacy-fallback zonder external_invoice_id", () => {
    const r = resolveContributionInvoice({
      contrib: { amount: 3000, invoice_number: "A", paid: false, external_invoice_id: null },
      invoices: [
        { invoice_number: "A", amount: 1500 },
        { invoice_number: "B", amount: 1500 },
      ],
      defaultAmount: 3000,
    });
    expect(r.source).toBe("legacy");
    expect(r.invoicedAmount).toBe(3000);
    expect(r.invoiceNumbers).toEqual(["A", "B"]);
    expect(r.status).toBe("sent");
  });

  it("toont 'nog te versturen' zonder enige factuur", () => {
    const r = resolveContributionInvoice({ contrib: null, invoices: [], defaultAmount: 3000 });
    expect(r.status).toBe("todo");
    expect(r.hasInvoice).toBe(false);
    expect(r.invoicedAmount).toBe(3000);
  });
});

describe("hasCanonicalInvoice", () => {
  it("herkent een Informer-snapshot met factuurnummer", () => {
    expect(hasCanonicalInvoice({ external_invoice_id: "inf-8", invoice_number: "2026-0008" })).toBe(true);
    expect(hasCanonicalInvoice({ external_invoice_id: "inf-8", invoice_number: null })).toBe(false);
    expect(hasCanonicalInvoice({ invoice_number: "2026-0008" })).toBe(false);
    expect(hasCanonicalInvoice(null)).toBe(false);
  });
});

describe("buildCanonicalInvoiceRows", () => {
  const canonicalContrib = {
    member_id: 142,
    amount: 1000,
    invoice_number: "2026-0009",
    invoice_date: "2026-02-01",
    paid: false,
    external_invoice_id: "inf-9",
  };
  const placeholder = { id: "ph-1", member_id: 142, invoice_number: null, amount: 1000, invoice_date: "2026-02-01" };

  it("telt canonieke factuur + placeholder als exact één factuur van 1000 open", () => {
    const rows = buildCanonicalInvoiceRows({
      contributions: [canonicalContrib],
      invoices: [placeholder],
    });
    expect(rows).toHaveLength(1);
    const totals = sumCanonicalInvoiceRows(rows);
    expect(totals.invoiced).toBe(1000);
    expect(totals.open).toBe(1000);
    expect(totals.paid).toBe(0);
    expect(rows[0]!.invoiceNumber).toBe("2026-0009");
    expect(rows[0]!.source).toBe("informer");
  });

  it("betaalde canonieke factuur met placeholder: 1000 gefactureerd, 0 openstaand", () => {
    const rows = buildCanonicalInvoiceRows({
      contributions: [{ ...canonicalContrib, member_id: 141, invoice_number: "2026-0008", paid: true, external_invoice_id: "inf-8" }],
      invoices: [{ ...placeholder, member_id: 141 }],
      paymentsByMember: new Map([[141, { amount: 1000, paidDate: "2026-03-01" }]]),
    });
    expect(rows).toHaveLength(1);
    const totals = sumCanonicalInvoiceRows(rows);
    expect(totals.invoiced).toBe(1000);
    expect(totals.paid).toBe(1000);
    expect(totals.open).toBe(0);
  });

  it("behoudt meerdere echte facturen van een legacy lid zonder external_invoice_id", () => {
    const rows = buildCanonicalInvoiceRows({
      contributions: [{ member_id: 10, amount: 3000, paid: false, external_invoice_id: null }],
      invoices: [
        { id: "a", member_id: 10, invoice_number: "A", amount: 1500 },
        { id: "b", member_id: 10, invoice_number: "B", amount: 1500 },
      ],
      paymentsByMember: new Map([[10, { amount: 1500, paidDate: "2026-04-01" }]]),
    });
    expect(rows).toHaveLength(2);
    const totals = sumCanonicalInvoiceRows(rows);
    expect(totals.invoiced).toBe(3000);
    // betaling wordt volgordelijk verdeeld, nooit dubbel geteld
    expect(totals.paid).toBe(1500);
    expect(totals.open).toBe(1500);
  });
});
