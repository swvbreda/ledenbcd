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
import { documentKind, splitByKind } from "./importantDocuments";
import { assertSafeDocumentUrl, openInNativeShell } from "./openProtectedDocument";

describe("document kinds within a subject", () => {
  const doc = (id: string, aan?: string) => ({ ...documents[0], id, aan });
  it("classifies verified BCD letters, received letters and unknowns", () => {
    expect(documentKind(doc("gemeenteraden-20260408", "Alle gemeenteraden"))).toBe("Verstuurd door BCD");
    expect(documentKind(doc("meester-20250904"))).toBe("Ontvangen brieven");
    expect(documentKind(doc("notitie-20251127"))).toBe("Overige documenten");
  });
  it("never treats a municipal recipient as a municipal document", () => {
    expect(documentKind(doc("onbekend", "Gemeente Utrecht"))).toBe("Overige documenten");
  });
  it("keeps order and every record exactly once in fixed kind order", () => {
    const items = [doc("notitie-20251127"), doc("jenv-20250916"), doc("meester-20250904"), doc("mkb-debat")];
    expect(splitByKind(items).map(g => [g.name, g.documents.map(d => d.id)])).toEqual([
      ["Verstuurd door BCD", ["jenv-20250916", "mkb-debat"]],
      ["Ontvangen brieven", ["meester-20250904"]],
      ["Overige documenten", ["notitie-20251127"]],
    ]);
  });
});

describe("protected document opening", () => {
  it("rejects non-https links", () => {
    expect(() => assertSafeDocumentUrl("http://x.test/a.pdf")).toThrow();
    expect(() => assertSafeDocumentUrl("javascript:alert(1)")).toThrow();
  });
  it("native shell navigates to the signed https link", () => {
    let target = "";
    openInNativeShell("https://storage.test/a.pdf?token=t", u => { target = u; });
    expect(target).toBe("https://storage.test/a.pdf?token=t");
  });
});
