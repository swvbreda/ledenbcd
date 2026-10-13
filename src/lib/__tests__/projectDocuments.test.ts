import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES, documentPath, sha256Hex, validateDocumentFile } from "../projectDocuments";

describe("projectdocumenten", () => {
  it("PDF, DOCX en XLSX toegestaan", () => {
    expect(validateDocumentFile({ name: "Brief.PDF", type: "application/pdf", size: 10 })).toEqual({ ext: "pdf", mime: "application/pdf" });
    expect(validateDocumentFile({ name: "verslag.docx", type: "", size: 10 })).toHaveProperty("ext", "docx");
    expect(validateDocumentFile({ name: "lijst.xlsx", type: "", size: 10 })).toHaveProperty("ext", "xlsx");
  });
  it("andere typen en vervalst type geweigerd", () => {
    expect(validateDocumentFile({ name: "x.exe", type: "", size: 10 })).toHaveProperty("error");
    expect(validateDocumentFile({ name: "x.doc", type: "", size: 10 })).toHaveProperty("error");
    expect(validateDocumentFile({ name: "x.pdf", type: "text/html", size: 10 })).toHaveProperty("error");
  });
  it("maximaal 20 MB, leeg geweigerd", () => {
    expect(validateDocumentFile({ name: "x.pdf", type: "", size: MAX_DOCUMENT_BYTES })).toHaveProperty("ext");
    expect(validateDocumentFile({ name: "x.pdf", type: "", size: MAX_DOCUMENT_BYTES + 1 })).toHaveProperty("error");
    expect(validateDocumentFile({ name: "x.pdf", type: "", size: 0 })).toHaveProperty("error");
  });
  it("pad = project/hash.ext, hash van de originele bytes", async () => {
    const h = await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer);
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(documentPath("p1", h, "pdf")).toBe(`p1/${h}.pdf`);
  });
});
