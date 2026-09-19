import { describe, it, expect } from "vitest";
import { resolveContributionInvoice, hasCanonicalInvoice } from "../contributionInvoice";

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
