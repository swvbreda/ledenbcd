import { describe, expect, it } from "vitest";
import {
  dedupeLocations,
  locationDeletionIdentity,
  locationIdentity,
  mergeMemberLocations,
  replacementDeletionIdentities,
} from "@/lib/memberLocations";

describe("mergeMemberLocations", () => {
  it("behoudt een later toegevoegde basislocatie naast oudere bewerkingen", () => {
    const base = [
      { naam: "Green House Centrum", adres: "Oudezijds Voorburgwal 191", postcode: "1012EW" },
      { naam: "Greenhouse Lounge", adres: "Haarlemmerstraat 64", postcode: "1013 ET" },
    ];
    const olderEdit = [
      { naam: "Green House Centrum", adres: "Oudezijds Voorburgwal 191", postcode: "1012 EW" },
    ];

    expect(mergeMemberLocations(base, olderEdit)).toHaveLength(2);
  });

  it("past een correctie toe zonder dezelfde vestiging dubbel te tellen", () => {
    const result = mergeMemberLocations(
      [{ naam: "Shop", adres: "Straat 1", postcode: "1234AB" }],
      [{ naam: "Shop nieuw", adres: "Straat 1", postcode: "1234 AB", website: "https://voorbeeld.nl" }],
    );

    expect(result).toEqual([
      { naam: "Shop nieuw", adres: "Straat 1", postcode: "1234 AB", website: "https://voorbeeld.nl" },
    ]);
  });

  it("respecteert een expliciet verwijderde locatie", () => {
    const removed = { naam: "Shop", adres: "Straat 1", postcode: "1234 AB" };
    expect(mergeMemberLocations([removed], [], [locationIdentity(removed)])).toEqual([]);
  });

  it("verwijdert alleen het gekozen adres wanneer twee locaties dezelfde postcode hebben", () => {
    const retained = { naam: "Boerejongens BIJ", adres: "Utrechtsestraat 21", postcode: "1017 VH", plaats: "Amsterdam" };
    const removed = { naam: "Boerejongens Center", adres: "Utrechtsestraat 47", postcode: "1017 VH", plaats: "Amsterdam" };

    expect(mergeMemberLocations([retained, removed], [retained], [locationDeletionIdentity(removed)]))
      .toEqual([retained]);
  });

  it("blijft bestaande verwijdermarkeringen op postcode ondersteunen", () => {
    const removed = { naam: "Shop", adres: "Straat 1", postcode: "1234 AB" };
    expect(mergeMemberLocations([removed], [], [locationIdentity(removed)])).toEqual([]);
  });

  it("telt hetzelfde Alien-adres zonder postcode maar één keer", () => {
    const result = dedupeLocations([
      { naam: "Alien", adres: "Korte Woldpromenade 8", plaats: "Steenwijk" },
      { naam: "Coffeeshop Alien", adres: "Korte Woldpromenade 8", postcode: "8331 JK", plaats: "Steenwijk" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ postcode: "8331 JK", adres: "Korte Woldpromenade 8" });
  });

  it("herkent Alien ook bij kleine fouten in straatnaam en postcode", () => {
    const result = dedupeLocations([
      { naam: "Coffeeshop Alien", adres: "Korte Woldpromenade 8", postcode: "8331 JK", plaats: "Steenwijk" },
      {
        naam: "Alien",
        adres: "Kort Walspromenade 8",
        postcode: "8331 JP",
        plaats: "Steenwijk",
        kvk: "83928103",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      naam: "Coffeeshop Alien",
      adres: "Korte Woldpromenade 8",
      postcode: "8331 JK",
      kvk: "83928103",
    });
  });

  it("voegt hetzelfde adres in verschillende plaatsen niet samen", () => {
    expect(dedupeLocations([
      { naam: "Shop A", adres: "Dorpsstraat 1", plaats: "Tiel" },
      { naam: "Shop B", adres: "Dorpsstraat 1", plaats: "Utrecht" },
    ])).toHaveLength(2);
  });

  it("houdt verschillende huisnummers met dezelfde postcode apart", () => {
    expect(dedupeLocations([
      { naam: "Boerejongens BIJ", adres: "Utrechtsestraat 21", postcode: "1017 VH", plaats: "Amsterdam" },
      { naam: "Boerejongens Center", adres: "Utrechtsestraat 47", postcode: "1017 VH", plaats: "Amsterdam" },
    ])).toHaveLength(2);
  });

  it("houdt dezelfde vestigingsnaam op verschillende adressen apart", () => {
    expect(dedupeLocations([
      { naam: "Coffeeshop Voorbeeld", adres: "Straat 1", postcode: "1234 AA", plaats: "Tiel" },
      { naam: "Coffeeshop Voorbeeld", adres: "Laan 2", postcode: "1234 BB", plaats: "Tiel" },
    ])).toHaveLength(2);
  });

  it("voegt ontbrekende huisnummertoevoegingen alleen bij dezelfde vestiging samen", () => {
    expect(dedupeLocations([
      { naam: "Yin Yang", adres: "Knollendamstraat 5", postcode: "1013 TL", plaats: "Amsterdam" },
      { naam: "Ying Yang", adres: "Knollendamstraat 5hs", postcode: "1013TL", plaats: "Amsterdam" },
    ])).toHaveLength(1);

    expect(dedupeLocations([
      { naam: "Shop A", adres: "Dorpsstraat 5A", postcode: "1234 AA", plaats: "Tiel" },
      { naam: "Shop B", adres: "Dorpsstraat 5B", postcode: "1234 AA", plaats: "Tiel" },
    ])).toHaveLength(2);
  });

  it("voegt een lege doublure met dezelfde naam en plaats samen", () => {
    expect(dedupeLocations([
      { naam: "Huzur 33", adres: "Sloterbeekstraat 33", postcode: "5912 GT", plaats: "Venlo" },
      { naam: "Huzur 33", plaats: "Venlo" },
    ])).toHaveLength(1);
  });

  it("markeert bij een verhuizing alleen het oude adres als vervangen", () => {
    const oud = { naam: "Superfly", adres: "Begijnhof 4", postcode: "1941 BP", plaats: "Beverwijk" };
    const nieuw = { ...oud, adres: "Koningstraat 8", postcode: "1941 BD" };
    expect(replacementDeletionIdentities([], oud, nieuw)).toEqual([locationDeletionIdentity(oud)]);
    expect(mergeMemberLocations([oud], [nieuw], replacementDeletionIdentities([], oud, nieuw)))
      .toEqual([nieuw]);
  });
});
