/**
 * Presentatie: verbergt uitsluitend HERKENBARE automatisch ingevoerde bron-/importboilerplate.
 * Alleen teksten met een bekend automatisch importkenmerk worden opgeschoond; menselijke vrije tekst
 * (ook met 'Bron:', 'import', documentnamen, links of mailadressen) blijft letterlijk staan.
 * Display-only: de database wordt nooit gewijzigd.
 */

/** Kenmerken die alleen in onze automatische imports voorkomen. */
const AUTO_MARKERS = [
  /^Bron: Topical BCD — (actie \d+|agendapunt:)/m,
  /^Bronlijst: https:\/\/bcd\.topicalmeetings\.com\//m,
  /^Bronimport — aanbevolen interne vervolgactie/m,
  /^Broncontrole \d{1,2} \w+ \d{4}\./m,
  /^Stand van zaken — broncontrole \d/m,
  /^Voorlopig werkoverzicht — interne registratie \d/m,
  /^Bron gelezen in Apple Mail\b/m,
];
export const isAutoImportText = (raw: string | null | undefined) => !!raw && AUTO_MARKERS.some((r) => r.test(raw));

const DROP_LINE = [
  /^Bron\s*:/,
  /^Bronlijst\s*:/,
  /^Bron gelezen in Apple Mail\b/,
  /^Bronimport — /,
  /^Accounttoewijzing\s*:/,
  /^Status volgens Topical\s*:/,
  /^Eigenaar en taakdeadline niet vastgesteld; daarom niet toegewezen/,
  /^Deadline, budget en projectverantwoordelijke: alleen invullen na bevestiging/,
  /^Registratiestand van de bestaande interne takenlijst/,
];
/** Exacte bekende boilerplatezinnen (geen brede woordfilters). */
const DROP_SENTENCE = [
  /^Geen [^.]* (vanuit|binnen) deze (dossier)?import\.?$/,
  /^Een lokale afronding of oude brondeadline bewijst geen actuele externe afspraak of afronding\.?$/,
  /^De download wordt aangeduid als .*_\d{8}\.(pdf|docx?|xlsx?)\.?$/,
  /^Bron: .*\d{4}(-\d{2}-\d{2}|\)|\b).*\.?$/,
];
const FILE = /\b[A-Z][\w-]*(?: [\w-]+){0,3}_\d{8}\.(?:pdf|docx?|xlsx?|pptx?)\b/g;

function cleanSentences(line: string): string {
  return line.split(/(?<=\.)\s+(?=[A-Z])/).filter((s) => !DROP_SENTENCE.some((r) => r.test(s.trim()))).join(" ");
}

export function presentText(raw: string | null | undefined): string {
  if (!raw) return "";
  if (!isAutoImportText(raw)) return raw;
  const out: string[] = [];
  for (let line of raw.replace(/\r\n/g, "\n").split("\n")) {
    const t = line.trim();
    if (t && DROP_LINE.some((r) => r.test(t))) continue;
    line = line
      .replace(/^(Stand van zaken) — broncontrole\s+/, "$1 — ")
      .replace(/^\s*Broncontrole\s+\d{1,2}\s+\w+\s+\d{4}\.\s*/, "")
      .replace(/\s*—\s*bron topical\s+\d+/gi, "")
      .replace(/\s+volgens Topical(?=\s*:)/g, "")
      .replace(/\s+in deze bron(nen)?\b/g, "")
      .replace(/\bDe bron noemt\b/g, "Genoemd wordt")
      .replace(FILE, "bijlage")
      .replace(/\bbijlage bijlage\b/gi, "bijlage")
      .replace(/;\s*bijlage(?=\.|$)/gi, "");
    line = cleanSentences(line);
    if (t && !line.trim()) continue;
    out.push(line.replace(/\s+$/, ""));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Bij opslaan: ongewijzigde opgeschoonde tekst niet terugschrijven (origineel blijft bewaard). */
export function changedText(original: string | null | undefined, edited: string): string | null | undefined {
  return edited.trim() === presentText(original).trim() ? undefined : edited.trim() || null;
}

/** Historie: alleen bronupdate-events worden algemeen; overige samenvattingen blijven letterlijk. */
export function presentEventSummary(ev: { event_type?: string | null; summary: string }): string {
  return ev.event_type === "bronupdate_geplaatst" ? "Stand van zaken bijgewerkt" : ev.summary;
}
