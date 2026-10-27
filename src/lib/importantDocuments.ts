import type { KnowledgeDocument } from "./knowledgeBase";

// Canonical source IDs only where the source has no usable subject metadata.
const DOCUMENT_SUBJECTS: Record<string, string> = {
  "amsterdam-2006-nevenproducten": "Nevenproducten en verkoopregels",
  "analyse-eerste-vervolgmeting-2026": "Experiment gesloten coffeeshopketen",
};

export function documentSubject(document: KnowledgeDocument): string {
  if (document.dossierSlug === "schaarse-vergunningen") return "Schaarse vergunningen";
  return DOCUMENT_SUBJECTS[document.id] ?? "Overig";
}

function reliableDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function groupDocuments(documents: KnowledgeDocument[], subject = "all") {
  const groups = new Map<string, KnowledgeDocument[]>();
  for (const document of documents) {
    const name = documentSubject(document);
    if (subject !== "all" && name !== subject) continue;
    const group = groups.get(name) ?? [];
    group.push(document);
    groups.set(name, group);
  }
  return [...groups].sort(([a], [b]) => a === "Overig" ? 1 : b === "Overig" ? -1 : a.localeCompare(b, "nl"))
    .map(([name, items]) => ({ name, documents: [...items].sort((a, b) => {
      const aDate = reliableDate(a.datum);
      const bDate = reliableDate(b.datum);
      // With incomplete dates the whole subject is alphabetical, avoiding a non-transitive comparator.
      if (items.every(item => reliableDate(item.datum) !== null) && aDate !== null && bDate !== null && aDate !== bDate) return bDate - aDate;
      return a.titel.localeCompare(b.titel, "nl") || a.id.localeCompare(b.id);
    }) }));
}

export function legacyDocumentTarget(hash: string): string | null {
  const value = hash.replace(/^#/, "");
  if (["documenten", "brieven", "brieven-voor-leden", "brieven-en-bestanden-voor-leden"].includes(value)) return "/belangrijke-documenten";
  return null;
}