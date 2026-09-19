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

export interface MemberContributionRecord extends CanonicalContribution {
  member_id: number;
}

export interface MemberInvoiceRecord extends LocalInvoiceRow {
  id: string;
  member_id: number;
}

export interface CanonicalInvoiceRow {
  key: string;
  member_id: number;
  source: "informer" | "legacy";
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amount: number;
  paidAmount: number;
  openAmount: number;
  paid: boolean;
  paidDate: string | null;
}

/**
 * Bouwt exact één canonieke factuurregel per Informer-snapshot (external_invoice_id)
 * en negeert dan alle lokale shadow/placeholderrijen van dat lid/jaar.
 * Legacy-leden zonder snapshot houden hun bestaande lokale facturen, elk als
 * afzonderlijke regel; een betaling wordt daarbij volgordelijk verdeeld zodat
 * ze nooit dubbel wordt geteld.
 */
export function buildCanonicalInvoiceRows(input: {
  contributions?: MemberContributionRecord[] | null;
  invoices?: MemberInvoiceRecord[] | null;
  paymentsByMember?: Map<number, PaymentInfo> | null;
  defaultAmount?: number;
}): CanonicalInvoiceRow[] {
  const contributions = input.contributions ?? [];
  const invoices = input.invoices ?? [];
  const payments = input.paymentsByMember ?? new Map<number, PaymentInfo>();
  const defaultAmount = input.defaultAmount ?? 0;

  const contribByMember = new Map<number, MemberContributionRecord>();
  contributions.forEach((c) => contribByMember.set(c.member_id, c));

  const invoicesByMember = new Map<number, MemberInvoiceRecord[]>();
  invoices.forEach((inv) => {
    const list = invoicesByMember.get(inv.member_id) ?? [];
    list.push(inv);
    invoicesByMember.set(inv.member_id, list);
  });

  const rows: CanonicalInvoiceRow[] = [];
  const memberIds = new Set<number>([...contribByMember.keys(), ...invoicesByMember.keys()]);

  for (const memberId of memberIds) {
    const contrib = contribByMember.get(memberId) ?? null;
    const local = invoicesByMember.get(memberId) ?? [];
    const payment = payments.get(memberId) ?? null;

    if (hasCanonicalContribution(contrib)) {
      const resolved = resolveContributionInvoice({ contrib, invoices: [], payment, defaultAmount });
      rows.push({
        key: `contrib:${memberId}`,
        member_id: memberId,
        source: "informer",
        invoiceNumber: resolved.invoiceNumbers[0] ?? null,
        invoiceDate: resolved.invoiceDate,
        amount: resolved.invoicedAmount,
        paidAmount: resolved.paidAmount,
        openAmount: resolved.openAmount,
        paid: resolved.status === "paid",
        paidDate: resolved.paidDate,
      });
      continue;
    }

    let remainingPaid = payment?.amount ?? (contrib?.paid ? num(contrib.amount) ?? 0 : 0);
    for (const inv of local) {
      const amount = num(inv.amount) ?? num(contrib?.amount) ?? defaultAmount;
      const paidAmount = Math.min(Math.max(remainingPaid, 0), amount);
      remainingPaid -= paidAmount;
      const openAmount = Math.max(0, amount - paidAmount);
      rows.push({
        key: inv.id,
        member_id: memberId,
        source: "legacy",
        invoiceNumber: inv.invoice_number ?? null,
        invoiceDate: inv.invoice_date ?? contrib?.invoice_date ?? inv.created_at ?? null,
        amount,
        paidAmount,
        openAmount,
        paid: openAmount <= 0.01,
        paidDate: payment?.paidDate ?? contrib?.paid_date ?? null,
      });
    }
  }

  return rows;
}

function hasCanonicalContribution(contrib?: CanonicalContribution | null): boolean {
  return !!(contrib && String(contrib.external_invoice_id ?? "").trim());
}

export function sumCanonicalInvoiceRows(rows: CanonicalInvoiceRow[]): {
  invoiced: number;
  paid: number;
  open: number;
} {
  return rows.reduce(
    (acc, r) => ({
      invoiced: acc.invoiced + r.amount,
      paid: acc.paid + r.paidAmount,
      open: acc.open + r.openAmount,
    }),
    { invoiced: 0, paid: 0, open: 0 },
  );
}
