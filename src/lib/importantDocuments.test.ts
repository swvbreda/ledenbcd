import { describe, expect, it } from "vitest";
import { documentSubject, groupDocuments, legacyDocumentTarget } from "./importantDocuments";
import { parseKnowledgePayload } from "./knowledgeBase";

const documents = parseKnowledgePayload({ documenten: [
  { id: "new", titel: "Z nieuwste", datum: "2026-04-08", dossier: "schaarse-vergunningen", beschikbaar: true },
  { id: "old", titel: "A oudste", datum: "2024-06-03", dossier: "schaarse-vergunningen" },
  { id: "amsterdam-2006-nevenproducten", titel: "Nevenproducten", datum: "2006-06-01" },
  { id: "analyse-eerste-vervolgmeting-2026", titel: "Experiment", datum: "2026-09-23" },
  { id: "unknown", titel: "Onbekend", categorie: "nieuwe-categorie" },
] }).documenten;

describe("important document grouping", () => {
  it("keeps every canonical record exactly once without mutating input", () => {
    const before = JSON.stringify(documents);
    const grouped = groupDocuments(documents).flatMap(group => group.documents);
    expect(grouped.map(doc => doc.id).sort()).toEqual(documents.map(doc => doc.id).sort());
    expect(grouped.find(doc => doc.id === "new")).toBe(documents[0]);
    expect(JSON.stringify(documents)).toBe(before);
  });
  it("uses the existing scarce-permits dossier, known source IDs and Overig for unknown subjects", () => {
    expect(documents.map(documentSubject)).toEqual(["Schaarse vergunningen", "Schaarse vergunningen", "Nevenproducten en verkoopregels", "Experiment gesloten coffeeshopketen", "Overig"]);
  });
  it("filters exactly one subject and sorts trustworthy dates newest first", () => {
    expect(groupDocuments(documents, "Schaarse vergunningen").map(group => group.documents.map(doc => doc.id))).toEqual([["new", "old"]]);
    expect(groupDocuments(documents, "absent")).toEqual([]);
  });
  it.each(["", "2026-02-30", "juli 2024"])("uses alphabetical titles when a subject has an unreliable date (%s)", datum => {
    const items = [{ ...documents[0], datum }, documents[1]];
    expect(groupDocuments(items)[0].documents.map(doc => doc.id)).toEqual(["old", "new"]);
  });
  it("preserves known old section links without redirecting ordinary knowledge-bank sections", () => {
    expect(legacyDocumentTarget("#documenten")).toBe("/belangrijke-documenten");
    expect(legacyDocumentTarget("brieven-voor-leden")).toBe("/belangrijke-documenten");
    expect(legacyDocumentTarget("#dossiers")).toBeNull();
  });
});