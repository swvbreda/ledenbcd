/**
 * Canonieke factuurbepaling voor het contributieoverzicht.
 *
 * Heeft een member_contributions-record een external_invoice_id, dan is dat de
 * uit Informer gesynchroniseerde factuur voor dat lid/jaar en is die leidend.
 * Lokale contribution_invoices-rijen (shadow/placeholder) tellen dan niet mee.
 * Zonder external_invoice_id blijft de oude fallback via contribution_invoices.
 */

export interface CanonicalContribution {
  amount?: number | string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  paid?: boolean | null;
  paid_date?: string | null;
  external_invoice_id?: string | null;
}

export interface LocalInvoiceRow {
  invoice_number?: string | null;
  amount?: number | string | null;
  invoice_date?: string | null;
  created_at?: string | null;
}

export interface PaymentInfo {
  amount: number;
  paidDate: string | null;
}

export type InvoiceRowStatus = "todo" | "sent" | "paid";

export interface ResolvedContributionInvoice {
  /** 'informer' = canonieke Informer-factuur, 'legacy' = lokale rijen, 'none' = nog niets. */
  source: "informer" | "legacy" | "none";
  hasInvoice: boolean;
  invoicedAmount: number;
  invoiceNumbers: string[];
  invoiceDate: string | null;
  paidAmount: number;
  openAmount: number;
  paidDate: string | null;
  status: InvoiceRowStatus;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveContributionInvoice(input: {
  contrib?: CanonicalContribution | null;
  invoices?: LocalInvoiceRow[] | null;
  payment?: PaymentInfo | null;
  defaultAmount: number;
}): ResolvedContributionInvoice {
  const { contrib, defaultAmount } = input;
  const invoices = input.invoices ?? [];
  const payment = input.payment ?? null;

  const canonical = !!(contrib && String(contrib.external_invoice_id ?? "").trim());

  if (canonical && contrib) {
    const invoicedAmount = num(contrib.amount) ?? defaultAmount;
    const number = String(contrib.invoice_number ?? "").trim();
    // Betalingen leveren alleen aanvullende informatie; nooit het factuurbedrag.
    const paidAmount = payment && payment.amount > 0
      ? payment.amount
      : contrib.paid
        ? invoicedAmount
        : 0;
    const openAmount = Math.max(0, invoicedAmount - paidAmount);
    const paid = openAmount <= 0.01;
    return {
      source: "informer",
      hasInvoice: true,
      invoicedAmount,
      invoiceNumbers: number ? [number] : [],
      invoiceDate: contrib.invoice_date ?? null,
      paidAmount,
      openAmount,
      paidDate: payment?.paidDate ?? contrib.paid_date ?? null,
      status: paid ? "paid" : "sent",
    };
  }

  const hasInvoice = invoices.length > 0;
  const invoicedAmount = hasInvoice
    ? invoices.reduce((sum, i) => sum + (num(i.amount) ?? defaultAmount), 0)
    : defaultAmount;
  const paidAmount = payment?.amount ?? (contrib?.paid ? num(contrib.amount) ?? 0 : 0);
  const openAmount = Math.max(0, invoicedAmount - paidAmount);
  const paid = hasInvoice && openAmount <= 0.01;
  return {
    source: hasInvoice ? "legacy" : "none",
    hasInvoice,
    invoicedAmount,
    invoiceNumbers: invoices.map((i) => String(i.invoice_number ?? "").trim()).filter(Boolean),
    invoiceDate: invoices[0]?.invoice_date ?? contrib?.invoice_date ?? invoices[0]?.created_at ?? null,
    paidAmount,
    openAmount,
    paidDate: payment?.paidDate ?? contrib?.paid_date ?? null,
    status: paid ? "paid" : hasInvoice ? "sent" : "todo",
  };
}

/** Heeft dit lid volgens de Informer-snapshot al een factuur voor dit jaar? */
export function hasCanonicalInvoice(contrib?: CanonicalContribution | null): boolean {
  return !!(
    contrib &&
    String(contrib.external_invoice_id ?? "").trim() &&
    String(contrib.invoice_number ?? "").trim()
  );
}
