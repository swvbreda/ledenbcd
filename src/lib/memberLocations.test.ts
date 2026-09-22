import { describe, expect, it } from "vitest";
import { dedupeLocations, locationDeletionIdentity, locationIdentity, mergeMemberLocations } from "@/lib/memberLocations";

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
});
