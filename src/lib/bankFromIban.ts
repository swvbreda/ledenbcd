/** Herleidt de bank uit een (Nederlands) IBAN via de 4-letterige bankcode. */

const BANK_CODES: Record<string, string> = {
  INGB: "ING",
  RABO: "Rabobank",
  ABNA: "ABN AMRO",
  SNSB: "SNS Bank",
  ASNB: "ASN Bank",
  RBRB: "RegioBank",
  KNAB: "Knab",
  BUNQ: "bunq",
  TRIO: "Triodos Bank",
  FVLB: "Van Lanschot",
  REVO: "Revolut",
  DEUT: "Deutsche Bank",
  NWAB: "Nederlandse Waterschapsbank",
  BNGH: "BNG Bank",
  HAND: "Svenska Handelsbanken",
  BCIT: "Intesa Sanpaolo",
  ANDL: "Anadolubank",
  LOYD: "Lloyds Bank",
  CITI: "Citibank",
  CHAS: "JPMorgan Chase",
  CITC: "CIT Bank",
  CLRB: "Clear Bank",
  CNBA: "Coöperatieve Rabobank",
  CRLY: "Crédit Lyonnais",
  CRUN: "Credit Europe Bank",
  CVBA: "Van Doorn",
  CVSL: "Credit Vision",
  CENL: "Commerzbank",
  CMCI: "Commerzbank",
  CSFP: "Credit Suisse",
  CSTP: "Coöperatieve Rabobank",
  CVIS: "Cardif",
  FBHL: "Credit Europe",
  FLOR: "Demir-Halk Bank",
  FRGH: "Ffrees",
  FTSB: "FTSB",
  FRNX: "Franx",
  GILL: "Insinger Gilissen",
  HSBC: "HSBC",
  ICBK: "ICBC",
  ISBK: "Isbank",
  KABA: "Yapi Kredi",
  KOEX: "KEB Hana Bank",
  KRED: "KBC Bank",
  MHCB: "Mizuho Bank",
  NNBA: "Nationale-Nederlanden Bank",
  PCBC: "China Construction Bank",
  RABN: "Rabobank",
  SOGE: "Société Générale",
  UGBI: "Garanti Bank",
  VOWA: "Volkswagen Bank",
  ZWLB: "Zwitserleven",
};

export const UNKNOWN_BANK = "Onbekend";

/** Normaliseer een IBAN: hoofdletters, zonder spaties/streepjes. */
export const normalizeIban = (iban: string): string =>
  (iban || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Naam van de bank bij een IBAN.
 * Nederlandse IBAN's: posities 5-8 bevatten de bankcode.
 * Buitenlandse IBAN's krijgen een landaanduiding.
 */
export function bankFromIban(iban: string | null | undefined): string {
  const clean = normalizeIban(iban ?? "");
  if (clean.length < 8) return UNKNOWN_BANK;
  const land = clean.slice(0, 2);
  const code = clean.slice(4, 8);
  if (land !== "NL") {
    return BANK_CODES[code] ? `${BANK_CODES[code]} (${land})` : `Buitenlands (${land})`;
  }
  return BANK_CODES[code] ?? `Overig (${code})`;
}

/** Leesbare weergave van een IBAN in groepjes van vier. */
export const formatIban = (iban: string): string =>
  normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
