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
export const DOCUMENT_KINDS = ["Verstuurd door BCD", "Ontvangen brieven", "Gemeentelijke documenten", "Overige documenten"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Verified sender/recipient per canonical ID (PDF letterhead/addressee or explicit catalog text).
// A municipal recipient never makes a document municipal; unknown IDs are "Overige documenten".
const DOCUMENT_KIND_BY_ID: Record<string, DocumentKind> = {
  "vng-2024": "Verstuurd door BCD",
  "ez-rondetafel-20241017": "Verstuurd door BCD",
  "vng-20250227": "Verstuurd door BCD",
  "jenv-20250916": "Verstuurd door BCD",
  "gemeenteraden-20260408": "Verstuurd door BCD",
  "mkb-debat": "Verstuurd door BCD",
  "minister-ez-20260707": "Verstuurd door BCD",
  "meester-20250904": "Ontvangen brieven",
  "jenv-20251216": "Ontvangen brieven",
};

export function documentKind(document: KnowledgeDocument): DocumentKind {
  return DOCUMENT_KIND_BY_ID[document.id] ?? "Overige documenten";
}

export function splitByKind(documents: KnowledgeDocument[]) {
  return DOCUMENT_KINDS.map(name => ({ name, documents: documents.filter(doc => documentKind(doc) === name) }))
    .filter(group => group.documents.length > 0);
}
