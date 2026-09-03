import { describe, expect, it } from "vitest";
import { locationDeletionIdentity, locationIdentity, mergeMemberLocations } from "@/lib/memberLocations";

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
});