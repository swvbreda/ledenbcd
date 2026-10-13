/**
 * Presentatie: verbergt HERKENBARE automatisch gegenereerde bron-/importmetadata uit bestaande imports
 * (projectplannen, Topical-omschrijvingen, controlepunt-opmerkingen). Inhoud, onzekerheden, datums,
 * namen en gewone mailadressen/links in de tekst blijven staan. Data in de database wordt niet gewijzigd.
 */
const DROP_LINE = [
  /^Bron\s*:/i,
  /^Bronlijst\s*:/i,
  /^Bron gelezen\b/i,
  /^Bronimport\b/i,
  /^Accounttoewijzing\s*:/i,
  /^Status volgens Topical\s*:/i,
  /^Eigenaar en taakdeadline niet vastgesteld/i,
  /^Deadline, budget en projectverantwoordelijke\s*:\s*alleen invullen/i,
  /^Registratiestand van de bestaande/i,
];
const DROP_SENTENCE = [
  /\b(dossier)?import\b/i,
  /\bbrondeadline\b/i,
  /\baangeduid als\b/i,
  /^Bron\s*:/i,
];
const FILE = /\b[A-Z][\w-]*(?: [\w-]+){0,3}_\d{8}\.(?:pdf|docx?|xlsx?|pptx?)\b/g;

function cleanSentences(line: string): string {
  // splits op zinsgrens: punt + spatie + hoofdletter
  const parts = line.split(/(?<=\.)\s+(?=[A-Z])/);
  return parts.filter((s) => !DROP_SENTENCE.some((r) => r.test(s))).join(" ");
}

export function presentText(raw: string | null | undefined): string {
  if (!raw) return "";
  const out: string[] = [];
  for (let line of raw.replace(/\r\n/g, "\n").split("\n")) {
    const t = line.trim();
    if (t && DROP_LINE.some((r) => r.test(t))) continue;
    line = line
      .replace(/—\s*broncontrole\s+/i, "— ")
      .replace(/^\s*Broncontrole\s+\d{1,2}\s+\w+\s+\d{4}\.\s*/i, "")
      .replace(/\s*—\s*bron topical\s+\d+/gi, "")
      .replace(/\s+volgens Topical(?=\s*:)/gi, "")
      .replace(/\s+in deze bron(nen)?\b/gi, "")
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

/** Algemene historie-omschrijving zonder mailonderwerp/bronrefs. */
export function presentEventSummary(ev: { event_type?: string | null; summary: string }): string {
  if (ev.event_type === "bronupdate_geplaatst" || /^Bronupdate\b/i.test(ev.summary)) return "Stand van zaken bijgewerkt";
  return presentText(ev.summary) || ev.summary;
}
