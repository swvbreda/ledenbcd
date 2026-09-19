import { describe, expect, it } from "vitest";
import { parseKnowledgePayload } from "./knowledgeBase";

describe("parseKnowledgePayload", () => {
  it("leest dossiers en vertrouwelijke documenten", () => {
    const result = parseKnowledgePayload({
      dossiers: [{ slug: "test", titel: "Test" }],
      documenten: [
        { id: "brief", titel: "Brief", downloadbaar: true, path: "geheim.pdf" },
      ],
    });

    expect(result.dossiers).toHaveLength(1);
    expect(result.documenten).toHaveLength(1);
    expect(result.documenten[0].beschikbaar).toBe(true);
    expect(result.documenten[0]).not.toHaveProperty("path");
  });

  it("ondersteunt een genest API-antwoord zonder extra velden over te nemen", () => {
    const result = parseKnowledgePayload({
      data: { dossiers: [], documents: [{ id: "brief", titel: "Brief" }] },
      storagePath: "mag-niet-worden-gebruikt.pdf",
    });

    expect(result.dossiers).toEqual([]);
    expect(result.documenten).toHaveLength(1);
    expect(result).not.toHaveProperty("storagePath");
  });

  it("weigert een ongeldig antwoord", () => {
    expect(() => parseKnowledgePayload(null)).toThrow("Ongeldig antwoord");
  });
});
