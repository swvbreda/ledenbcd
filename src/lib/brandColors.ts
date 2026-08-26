/** Huisstijlkleuren van banken en betaaldienstverleners voor diagrammen. */

const BANK_COLORS: Record<string, string> = {
  ING: "#FF6200",
  Rabobank: "#000099",
  "ABN AMRO": "#009286",
  "SNS Bank": "#EE7F00",
  "ASN Bank": "#5B9C3B",
  RegioBank: "#00539F",
  Knab: "#00A0DC",
  bunq: "#3394FF",
  "Triodos Bank": "#4C9F38",
  Revolut: "#0666EB",
  "Van Lanschot": "#0B3B60",
  "Insinger Gilissen": "#0B3B60",
  "Deutsche Bank": "#0018A8",
  "Nationale-Nederlanden Bank": "#EE7F00",
  "BNG Bank": "#00529B",
  HSBC: "#DB0011",
  KBC: "#00AEEF",
  "KBC Bank": "#00AEEF",
  Isbank: "#0A4A8B",
  "Garanti Bank": "#008D3F",
  "Credit Europe Bank": "#1B4F9C",
  "Société Générale": "#E9041E",
  Onbekend: "#B8BEC9",
};

const PSP_COLORS: Record<string, string> = {
  Worldline: "#46BEAA",
  CCV: "#E2001A",
  "EMS / Fiserv": "#FF6600",
  Adyen: "#0ABF53",
  Rabobank: "#000099",
  SumUp: "#1B2124",
  YourSafe: "#00A8E1",
  "CM.com": "#0057FF",
  Mollie: "#0B1436",
  Buckaroo: "#F49A00",
  Anders: "#B8BEC9",
  Onbekend: "#B8BEC9",
};

const FALLBACKS = [
  "#7A869A",
  "#9AA6B8",
  "#5E6A7D",
  "#AEB8C6",
  "#6B7A90",
  "#C3CAD5",
];

const pick = (map: Record<string, string>, label: string, index: number) =>
  map[label] ?? FALLBACKS[index % FALLBACKS.length];

/** Kleur voor een bank (op naam zoals bankFromIban die teruggeeft). */
export const bankColor = (bank: string, index = 0) => pick(BANK_COLORS, bank, index);

/** Kleur voor een betaaldienstverlener. */
export const pspColor = (naam: string, index = 0) => pick(PSP_COLORS, naam, index);
