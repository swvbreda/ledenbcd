import { describe, expect, it } from "vitest";
import { parsePlan } from "../projectPlan";

describe("parsePlan", () => {
  it("herkent koppen en Verloop-tijdlijn zonder bronlabel", () => {
    const s = parsePlan("Huidige stand\nGesprek gepland.\n\nVerloop:\n2026-10-01 | Brief | Brief verstuurd | Bron: mail\n2026-10-12 | Reactie | Antwoord ontvangen\n\nVervolg\n- Reactie volgen\n- Leden informeren\n\nPraktische opvolging\n1. Bellen");
    expect(s.map((x) => x.heading)).toEqual(["Huidige stand", "Verloop", "Vervolg", "Praktische opvolging"]);
    expect(s[1].blocks[0]).toEqual({ type: "timeline", items: [
      { date: "2026-10-01", title: "Brief", text: "Brief verstuurd" },
      { date: "2026-10-12", title: "Reactie", text: "Antwoord ontvangen" }] });
    expect(s[2].blocks[0]).toEqual({ type: "list", ordered: false, items: ["Reactie volgen", "Leden informeren"] });
    expect(s[3].blocks[0]).toEqual({ type: "list", ordered: true, items: ["Bellen"] });
  });
  it("menselijk plan zonder koppen blijft volledig behouden, geen HTML/Markdown-interpretatie", () => {
    const raw = "Doel: <b>vergunning</b> **regelen**\nmet gemeente | wethouder\n\n# Geen kop";
    const s = parsePlan(raw);
    expect(s).toEqual([{ heading: null, blocks: [
      { type: "paragraph", text: "Doel: <b>vergunning</b> **regelen**\nmet gemeente | wethouder" },
      { type: "paragraph", text: "# Geen kop" }] }]);
  });
  it("pipe-regels buiten Verloop of zonder datum blijven tekst", () => {
    const s = parsePlan("Verloop\nOnbekend | titel | tekst");
    expect(s[0].blocks[0]).toEqual({ type: "paragraph", text: "Onbekend | titel | tekst" });
  });
  it("leeg plan geeft niets", () => expect(parsePlan("  ")).toEqual([]));
});
