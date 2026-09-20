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

/**
 * Sleutel om factuurnummers te vergelijken: voorloopnullen weg en, bij lange
 * nummers, ook de "20xx"-jaarprefix genegeerd. Zo matcht `0260079` met
 * `20260079` en `2026 0408` met `20260408`.
 */
export function invoiceKey(value?: string | null): string {
  const digits = String(value || "").replace(/\D/g, "").replace(/^0+/, "");
  return digits;
}

/**
 * Alle waarschijnlijke factuurnummers uit een omschrijving.
 * Reeksen van tien of meer cijfers zijn doorgaans IBAN-/rekeningnummers en
 * worden bewust genegeerd, zodat die niet als factuurnummer in beeld komen.
 * Ook losse tokens met een scheidingsteken ("Fac nr 2026-0003") worden herkend:
 * in lange bankomschrijvingen staat het factuurnummer vrijwel altijd zo.
 */
export function invoiceNumbersIn(text?: string | null): string[] {
  const raw = String(text || "");
  const plain = raw.match(/\b\d{5,9}\b/g) || [];
  // "2026-0003", "2026/0003" → "20260003". Datums ("2026-06-24") vallen af,
  // omdat daar maar twee cijfers op het scheidingsteken volgen.
  const joined = (raw.match(/\b\d{4}[-/]\d{3,6}\b/g) || []).map((t) => t.replace(/\D/g, ""));
  return [...new Set([...plain, ...joined].filter((t) => t.length >= 5 && t.length <= 9))];
}


/** Alle factuurnummers van een regel: uit het factuurveld én de omschrijving. */
export function allInvoiceNumbers(entry: LedgerLike): string[] {
  // Ook het hele factuurveld als één nummer (bv. "2026-0010" → "20260010").
  const whole = String(entry.invoice || "").replace(/\D/g, "");
  return [
    ...new Set([
      ...(whole.length >= 5 && whole.length <= 9 ? [whole] : []),
      ...invoiceNumbersIn(entry.invoice),
      ...invoiceNumbersIn(entry.description),
    ]),
  ];
}


/**
 * Vergelijkbare sleutels van alle factuurnummers van een regel. Korte nummers
 * met voorloopnullen ("00082") blijven volledig staan: zonder die nullen zou
 * er te weinig overblijven om betrouwbaar op te vergelijken.
 */
export function invoiceKeysOf(entry: LedgerLike): string[] {
  return [
    ...new Set(
      allInvoiceNumbers(entry)
        .map((raw) => {
          const key = invoiceKey(raw);
          return key.length >= 5 ? key : raw;
        })
        .filter((k) => k.length >= 5),
    ),
  ];
}


/** True als twee genormaliseerde factuursleutels hetzelfde nummer aanduiden. */
export function invoiceKeysMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Bankomschrijvingen missen soms de eerste cijfers ("0260079" ⇢ "20260079").
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 6 && long.endsWith(short);
}

/**
 * True als beide regels hetzelfde factuurnummer noemen. Bedragen mogen
 * verschillen: een bankbetaling bundelt vaak meerdere facturen of verrekent
 * een creditnota, waardoor het betaalde bedrag afwijkt van de factuur.
 */
export function sharesInvoiceNumber(a: LedgerLike, b: LedgerLike): boolean {
  const keysA = invoiceKeysOf(a);
  if (keysA.length === 0) return false;
  const keysB = invoiceKeysOf(b);
  return keysA.some((n) => keysB.some((m) => invoiceKeysMatch(n, m)));
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
