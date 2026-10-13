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

describe("expliciet geïmporteerde velden (autoImport)", () => {
  const imp = { autoImport: true };
  it("PCN laatste actie: bestandsnaam en 'in deze bronnen' weg, inhoud blijft", () => {
    const out = presentText("De ledenupdate over samenwerking met PCN is op 12 oktober 2026 om 12:44 verzonden, met Brief_PCN_samenwerking_bijlage_20261008.pdf. Een nieuw akkoord of antwoord van PCN is in deze bronnen niet bevestigd.", imp);
    expect(out).toBe("De ledenupdate over samenwerking met PCN is op 12 oktober 2026 om 12:44 verzonden, met bijlage. Een nieuw akkoord of antwoord van PCN is niet bevestigd.");
  });
  it("PCN volgende stap: importboilerplate weg", () => {
    expect(presentText("Reactie van het PCN-bestuur volgen en bezorgproblemen intern laten controleren. Geen mail verzenden of externe contactactie uitvoeren vanuit deze dossierimport.", imp)).toBe("Reactie van het PCN-bestuur volgen en bezorgproblemen intern laten controleren.");
  });
  it("bronupdatekaart (Worldline): 'binnen deze import' weg", () => {
    expect(presentText("Evaluatietoegang intern voorbereiden. Geen toegang verlenen of uitnodiging verzenden binnen deze import.", imp)).toBe("Evaluatietoegang intern voorbereiden.");
  });
  it("Worldline- en PCN-projectomschrijving", () => {
    expect(presentText("Bronimport actuele Worldline-correspondentie; monitoring en evaluatietoegang. Geen bevestigde opdracht of bedrag.", imp)).toBe("Actuele Worldline-correspondentie; monitoring en evaluatietoegang. Geen bevestigde opdracht of bedrag.");
    expect(presentText("Dossier samenwerking BCD–PCN: correspondentie, ledeninformatie en opvolging. Stand gebaseerd op gelezen mail; geen nieuw samenwerkingsakkoord aangetoond.", imp)).toBe("Dossier samenwerking BCD–PCN: correspondentie, ledeninformatie en opvolging. Geen nieuw samenwerkingsakkoord aangetoond.");
  });
  it("zonder autoImport blijft dezelfde tekst letterlijk", () => {
    const t = "Stand gebaseerd op gelezen mail; geen akkoord. Zie Brief_X_20261008.pdf.";
    expect(presentText(t)).toBe(t);
  });
});
