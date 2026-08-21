// Gedeelde herkenning van "dezelfde betaling" die zowel via de bank (Ponto) als
// via Informer/handmatig in het systeem staat. Wordt gebruikt door de begroting,
// het dossieroverzicht en het controlescherm zodat overal dezelfde uitkomst geldt.

/** Tegenpartij normaliseren: rechtsvormen en leestekens weg. */
export function normalizeParty(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|holding|stichting)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Factuur-/declaratienummer normaliseren (alleen cijfers, min. 5 posities). */
export function normalizeInvoice(value?: string | null): string {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length >= 5 ? digits : "";
}

/** Alle factuurnummers (>= 5 cijfers) uit een omschrijving. */
export function invoiceNumbersIn(text?: string | null): string[] {
  return (String(text || "").match(/\d{5,}/g) || []).map((n) => n);
}

const dayNumber = (date?: string | null) => {
  if (!date) return NaN;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? NaN : Math.floor(t / 86400000);
};

export interface LedgerLike {
  date: string | null;
  amount: number;
  counterparty?: string | null;
  description?: string | null;
  invoice?: string | null;
  direction?: string;
}

export interface SamePaymentOptions {
  /** Maximaal verschil in dagen (standaard 10). */
  dayWindow?: number;
  /** Maximaal verschil in bedrag (standaard € 0,50). */
  amountTolerance?: number;
}

/**
 * True als twee regels vrijwel zeker dezelfde betaling zijn.
 * Bedrag moet altijd (bijna) gelijk zijn; daarna volstaat een gelijk
 * factuurnummer óf een gelijke tegenpartij binnen het datumvenster.
 */
export function isSamePayment(a: LedgerLike, b: LedgerLike, opts: SamePaymentOptions = {}): boolean {
  const { dayWindow = 10, amountTolerance = 0.5 } = opts;
  if ((a.direction || "out") !== (b.direction || "out")) return false;
  if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) > amountTolerance) return false;

  const invA = normalizeInvoice(a.invoice) || invoiceNumbersIn(a.description)[0] || "";
  const invB = normalizeInvoice(b.invoice) || invoiceNumbersIn(b.description)[0] || "";
  if (invA && invB && invA === invB) return true;

  const dayA = dayNumber(a.date);
  const dayB = dayNumber(b.date);
  const withinWindow =
    Number.isNaN(dayA) || Number.isNaN(dayB) ? true : Math.abs(dayA - dayB) <= dayWindow;
  if (!withinWindow) return false;

  const partyA = normalizeParty(a.counterparty);
  const partyB = normalizeParty(b.counterparty);
  if (partyA && partyB) return partyA === partyB;

  // Zonder tegenpartij: alleen als bedrag én dag exact overeenkomen.
  return dayA === dayB;
}
