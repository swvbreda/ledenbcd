import { afterEach, describe, expect, it, vi } from "vitest";
import { loadKnowledgeBase, parseKnowledgePayload } from "./knowledgeBase";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("leest de centrale kennisbankcatalogus met items en openbare paden", () => {
    const result = parseKnowledgePayload({
      items: [
        {
          slug: "nieuw-dossier",
          titel: "Nieuw dossier",
          pad: "/publicaties/nieuw-dossier",
          afbeelding: "https://coffeeshopbond.nl/cover.jpg",
          status: "Kennispagina",
          soort: "kennis",
          links: [
            { label: "Lees meer", href: "https://coffeeshopbond.nl/meer" },
          ],
          vragen: [{ vraag: "Waarom?", antwoord: "Daarom." }],
        },
      ],
    });

    expect(result.dossiers).toEqual([
      expect.objectContaining({
        slug: "nieuw-dossier",
        path: "/publicaties/nieuw-dossier",
        afbeelding: "https://coffeeshopbond.nl/cover.jpg",
        status: "Kennispagina",
        soort: "kennis",
        links: [
          expect.objectContaining({
            label: "Lees meer",
            href: "https://coffeeshopbond.nl/meer",
          }),
        ],
        qa: [{ vraag: "Waarom?", antwoord: "Daarom." }],
      }),
    ]);
  });

  it("weigert een ongeldig antwoord", () => {
    expect(() => parseKnowledgePayload(null)).toThrow("Ongeldig antwoord");
  });

  it("combineert actuele openbare dossiers met beveiligde ledenbestanden", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/leden/kennisbank") {
          expect(init?.headers).toMatchObject({
            Authorization: "Bearer test-token",
          });
          return new Response(
            JSON.stringify({
              dossiers: [{ slug: "oud", titel: "Oud dossier" }],
              documenten: [
                { id: "ledenbrief", titel: "Ledenbrief", beschikbaar: true },
              ],
            }),
            { status: 200 },
          );
        }

        if (url === "https://coffeeshopbond.nl/kennisbank.json") {
          expect(init?.headers).not.toHaveProperty("Authorization");
          return new Response(
            JSON.stringify({
              items: [{ slug: "actueel", titel: "Actueel dossier" }],
            }),
            { status: 200 },
          );
        }

        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadKnowledgeBase({
      access_token: "test-token",
      user: { id: "test-user" },
    } as never);

    expect(result.dossiers.map((item) => item.slug)).toEqual(["actueel"]);
    expect(result.documenten.map((item) => item.id)).toEqual(["ledenbrief"]);
  });

  it("valt terug op dossiers.json zolang de nieuwe feed nog niet live staat", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/leden/kennisbank") {
        return new Response(JSON.stringify({ dossiers: [], documenten: [] }));
      }
      if (url === "https://coffeeshopbond.nl/kennisbank.json") {
        return new Response(null, { status: 404 });
      }
      if (url === "https://coffeeshopbond.nl/dossiers.json") {
        return new Response(
          JSON.stringify({
            dossiers: [{ slug: "fallback", titel: "Fallback-dossier" }],
          }),
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadKnowledgeBase({
      access_token: "test-token",
      user: { id: "test-user" },
    } as never);

    expect(result.dossiers.map((item) => item.slug)).toEqual(["fallback"]);
  });
});
