import { describe, expect, it } from "vitest";
import { presentText } from "../presentText";

describe("bekende importprefix 'Bronimport actuele' zonder autoImport-vlag", () => {
  it("Worldline-omschrijving toont geen bronlabel", () => {
    expect(presentText("Bronimport actuele Worldline-correspondentie; monitoring en evaluatietoegang. Geen bevestigde opdracht of bedrag."))
      .toBe("Actuele Worldline-correspondentie; monitoring en evaluatietoegang. Geen bevestigde opdracht of bedrag.");
  });
  it("menselijke tekst over import blijft letterlijk", () => {
    for (const t of ["Import van de ledenlijst nog nakijken.", "Bron: gesprek met gemeente", "De bronimport actuele stand bespreken"])
      expect(presentText(t)).toBe(t);
  });
});
