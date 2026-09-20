import { describe, expect, it } from "vitest";
import {
  effectiveMember,
  findByLinkKey,
  isLocationDeleted,
  locationKeyOf,
  locationTarget,
  mergeMemberLocations,
  realLocationCount,
  sameFieldValue,
} from "./memberEffective.ts";

describe("effectiveMember", () => {
  it("laat een door het lid gecorrigeerd adres winnen van de basis", () => {
    const base = { locaties: [{ naam: "Shop", adres: "Oudestraat 1", postcode: "1234AB" }] };
    const overlay = { locaties: [{ naam: "Shop", postcode: "1234AB", adres: "Nieuwstraat 9" }] };
    const eff = effectiveMember(base, overlay);
    expect(eff.locaties).toHaveLength(1);
    expect(eff.locaties[0]!.adres).toBe("Nieuwstraat 9");
  });

  it("neemt een vestiging die alleen in de wijzigingslaag staat mee", () => {
    const eff = effectiveMember(
      { locaties: [{ naam: "A", postcode: "1000AA" }] },
      { locaties: [{ naam: "B", postcode: "2000BB" }] },
    );
    expect(eff.locaties.map((l) => l.naam)).toEqual(["A", "B"]);
  });

  it("verbergt een door het lid verwijderde vestiging", () => {
    const eff = effectiveMember(
      { locaties: [{ naam: "A", adres: "Straat 1", postcode: "1000AA" }] },
      { _verwijderdeLocaties: ["locatie:1000AA|straat1"] },
    );
    expect(eff.locaties).toHaveLength(0);
    expect(isLocationDeleted({ adres: "Straat 1", postcode: "1000AA" }, eff.verwijderd)).toBe(true);
  });

  it("voegt dubbele vestigingen met hetzelfde adres samen", () => {
    const merged = mergeMemberLocations(
      [
        { naam: "Shop", adres: "Straat 1", postcode: "1000AA" },
        { naam: "Shop", adres: "Straat 1", postcode: "1000AA", telefoon: "0201234567" },
      ],
      [],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.telefoon).toBe("0201234567");
  });
});

describe("locationTarget", () => {
  const base = { locaties: [{ naam: "A", postcode: "1000AA" }, { naam: "B", postcode: "2000BB" }] };
  const overlay = { locaties: [{ naam: "B", postcode: "2000BB", adres: "Nieuw 2" }] };

  it("wijst de wijzigingslaag aan wanneer de vestiging daar staat", () => {
    expect(locationTarget(base, overlay, { postcode: "2000BB" })).toEqual({
      layer: "overlay",
      index: 0,
    });
  });

  it("wijst de basis aan wanneer de vestiging alleen daar staat", () => {
    expect(locationTarget(base, overlay, { postcode: "1000AA" })).toEqual({
      layer: "base",
      index: 0,
    });
  });

  it("geeft niets terug voor een onbekende vestiging", () => {
    expect(locationTarget(base, overlay, { postcode: "9999ZZ" })).toBeNull();
  });
});

describe("sameFieldValue", () => {
  it("negeert spaties, hoofdletters en leestekens", () => {
    expect(sameFieldValue("adres", "Nieuwstraat 9-A", "nieuwstraat 9a")).toBe(true);
    expect(sameFieldValue("postcode", "1012 ab", "1012AB")).toBe(true);
  });

  it("negeert accenten", () => {
    expect(sameFieldValue("naam", "Café Blauw", "Cafe Blauw")).toBe(true);
  });

  it("ziet een echte verhuizing wél als verschil", () => {
    expect(sameFieldValue("adres", "Nieuwstraat 9", "Oudestraat 1")).toBe(false);
  });
});

describe("koppelsleutels", () => {
  it("bouwt de sleutel naam|adres|postcode", () => {
    expect(locationKeyOf({ naam: "De Shop", adres: "Straat 1", postcode: "1000 AA" })).toBe(
      "deshop|straat1|1000aa",
    );
  });

  it("vindt de vestiging via een samengestelde sleutel", () => {
    const locaties = [{ naam: "De Shop", adres: "Straat 1", postcode: "1000AA" }];
    expect(findByLinkKey(locaties, "deshop|straat1|1000aa")).toBe(locaties[0]);
  });

  it("vindt de vestiging ook als alleen het adres nog klopt", () => {
    const locaties = [{ naam: "Andere naam", adres: "Straat 1", postcode: "9999ZZ" }];
    expect(findByLinkKey(locaties, "deshop|straat1|1000aa")).toBe(locaties[0]);
  });

  it("telt alleen echte vestigingen", () => {
    expect(realLocationCount([{ adres: "Straat 1" }, { naam: "leeg" }, { plaats: "Utrecht" }])).toBe(
      2,
    );
  });
});
