import { describe, expect, it } from "vitest";
import { changedText, presentEventSummary, presentText } from "../presentText";

describe("presentText", () => {
  it("geïmporteerd projectplan: bronregels weg, inhoud en onzekerheid blijven", () => {
    const raw = "Stand van zaken — broncontrole 13 oktober 2026\n\nLaatste bevestigde actie (2026-10-13):\nFinanciën is bereid tot gezamenlijk gesprek. Een afspraakdatum is in deze bron niet bevestigd.\n\nBron: RE: Overleg — info@coffeeshopbond.nl — Inkomend — 2026-10-13 11:20.\nDeadline, budget en projectverantwoordelijke: alleen invullen na bevestiging.";
    const out = presentText(raw);
    expect(out).toContain("Stand van zaken — 13 oktober 2026");
    expect(out).toContain("Een afspraakdatum is niet bevestigd.");
    expect(out).not.toMatch(/Bron|info@coffeeshopbond|broncontrole/i);
  });
  it("Topical-omschrijving: actie-ID/URL weg, verantwoordelijke en deadline blijven", () => {
    const out = presentText("Bron: Topical BCD — actie 85959\nBronlijst: https://bcd.topicalmeetings.com/actions\nAgendapunt: Schaarse vergunningen\nVerantwoordelijke(n) volgens Topical: Tugrulhan\nStatus volgens Topical: Todo\nDeadline volgens Topical: 2026-03-03\nAccounttoewijzing: niet gekoppeld.");
    expect(out).toBe("Agendapunt: Schaarse vergunningen\nVerantwoordelijke(n): Tugrulhan\nDeadline: 2026-03-03");
  });
  it("importtaak en controlepunt: metadata en bestandsnamen weg, stand blijft", () => {
    const out = presentText("Bronimport — aanbevolen interne vervolgactie; geen externe communicatie uitgevoerd.\nBron: Samenwerking PCN BCD — info@coffeeshopbond.nl — Verstuurd — 2026-10-12 12:44.\nVervolg: Reactie volgen. Geen mail verzenden vanuit deze dossierimport.\nEigenaar en taakdeadline niet vastgesteld; daarom niet toegewezen.");
    expect(out).toBe("Vervolg: Reactie volgen.");
    expect(presentText("Broncontrole 13 oktober 2026. Verstuurd 13 oktober 2026 14:46; Reactie EGCK T1_20261013.pdf. Dit is een concept voor input.")).toBe("Verstuurd 13 oktober 2026 14:46. Dit is een concept voor input.");
  });
  it("menselijke vrije tekst met mailadres en link blijft ongewijzigd", () => {
    const human = "Bel Jan terug.\nMail info@gemeente.nl of kijk op https://example.nl/bron-pagina";
    expect(presentText(human)).toBe(human);
  });
  it("ongewijzigde opgeschoonde tekst wordt niet teruggeschreven; bewerking wel", () => {
    const raw = "Broncontrole 13 oktober 2026. Inhoud.";
    expect(changedText(raw, "Inhoud.")).toBeUndefined();
    expect(changedText(raw, "Inhoud aangepast.")).toBe("Inhoud aangepast.");
  });
  it("historie: bronupdate generiek", () => {
    expect(presentEventSummary({ event_type: "bronupdate_geplaatst", summary: "Bronupdate: RE: Overleg" })).toBe("Stand van zaken bijgewerkt");
  });
  it("menselijke tekst blijft letterlijk: importzin, aangeduid-als, Bron:, documentnaam, link en mailadres", () => {
    const human = "De import van leden loopt morgen.\nHet stuk wordt aangeduid als concept.\nBron: gesprek met de gemeente op 2026-10-01.\nZie Notulen_ALV_20261001.pdf en https://example.nl, mail jan@gemeente.nl.";
    expect(presentText(human)).toBe(human);
  });
  it("na handmatige bewerking opgeslagen tekst (zonder importkenmerk) blijft ongewijzigd", () => {
    const edited = presentText("Broncontrole 13 oktober 2026. Datum nog onbekend.") + "\nBron: telefoontje Bernard. Import KING stoppen.";
    expect(edited).toBe("Datum nog onbekend.\nBron: telefoontje Bernard. Import KING stoppen.");
    expect(presentText(edited)).toBe(edited);
  });
  it("historie: overige samenvattingen letterlijk", () => {
    expect(presentEventSummary({ event_type: "taak_gewijzigd", summary: "Import van leden gepland" })).toBe("Import van leden gepland");
  });
});
