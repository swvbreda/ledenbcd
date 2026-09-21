import { describe, it, expect } from "vitest";
import type { Member } from "@/data/types";
import {
  buildContactRows,
  buildLedenRows,
  buildLocatieRows,
  buildWorkbookData,
  effectiveContacts,
  exportFileName,
  formatLocationLine,
  sortMembersByNumber,
  splitAddress,
} from "@/lib/memberExport";
import { mergeMemberLocations } from "@/lib/memberLocations";

const member = (overrides: Partial<Member>): Member =>
  ({
    id: 1,
    naam: "Shop",
    plaats: "Amsterdam",
    stadsdeel: "Centrum",
    jarenLid: null,
    oprichtingJaar: null,
    contactpersoon: "",
    functie: "",
    telefoon: "",
    email: "",
    bedrijfsnaam: "",
    aantalLocaties: 0,
    locaties: [],
    contacten: [],
    ...overrides,
  }) as Member;

describe("memberExport", () => {
  it("sorteert numeriek oplopend en begint bij lidnummer 1", () => {
    const rows = buildLedenRows([
      member({ id: 10, naam: "Tien" }),
      member({ id: 2, naam: "Twee" }),
      member({ id: 1, naam: "Een" }),
    ]);
    expect(rows.map((r) => r.lidnr)).toEqual([1, 2, 10]);
    expect(rows[0].nr).toBe(1);
    expect(rows.map((r) => r.nr)).toEqual([1, 2, 3]);
  });

  it("zet niet-numerieke lidnummers achteraan", () => {
    const sorted = sortMembersByNumber([
      { id: "" as unknown as number, naam: "Zonder" },
      { id: 3, naam: "Drie" },
    ]);
    expect(sorted.map((m) => m.id)).toEqual([3, ""]);
  });

  it("exporteert elk lid precies één keer, ongeacht filters of paginering", () => {
    const alle = Array.from({ length: 131 }, (_, i) =>
      member({ id: i + 1, naam: `Lid ${i + 1}` }),
    );
    const rows = buildLedenRows(alle);
    expect(rows).toHaveLength(131);
    expect(new Set(rows.map((r) => r.lidnr)).size).toBe(131);
  });

  it("neemt meerdere locaties mee, zonder duplicaten", () => {
    const m = member({
      id: 5,
      locaties: [
        {
          naam: "A",
          adres: "Tolstraat 91",
          postcode: "1074 VK",
          plaats: "Amsterdam",
        },
        {
          naam: "B",
          adres: "Kerkstraat 2",
          postcode: "1017 GG",
          plaats: "Amsterdam",
        },
      ],
    });
    const leden = buildLedenRows([m]);
    expect(leden[0].aantalLocaties).toBe(2);
    expect(leden[0].locaties.split("\n")).toHaveLength(2);
    const locaties = buildLocatieRows([m]);
    expect(locaties).toHaveLength(2);
    expect(locaties.map((l) => l.locatienaam)).toEqual(["A", "B"]);
    expect(locaties[0]).toMatchObject({
      straat: "Tolstraat",
      huisnummer: "91",
      postcode: "1074 VK",
    });
  });

  it("gebruikt de samengevoegde locaties en laat verwijderde locaties weg", () => {
    const base = [
      {
        naam: "A",
        adres: "Tolstraat 91",
        postcode: "1074 VK",
        plaats: "Amsterdam",
      },
      {
        naam: "Oud",
        adres: "Kerkstraat 2",
        postcode: "1017 GG",
        plaats: "Amsterdam",
      },
    ];
    const overlay = [
      {
        naam: "A",
        adres: "Tolstraat 91",
        postcode: "1074 VK",
        plaats: "Amsterdam",
        stadsdeel: "Zuid",
      },
    ];
    const merged = mergeMemberLocations(base, overlay, [
      "locatie:1017GG|kerkstraat2",
    ]);
    const rows = buildLocatieRows([member({ id: 7, locaties: merged })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ locatienaam: "A", stadsdeel: "Zuid" });
  });

  it("splitst huisnummer en toevoeging", () => {
    expect(splitAddress("Schapenkamp 192 A")).toEqual({
      straat: "Schapenkamp",
      huisnummer: "192",
      toevoeging: "A",
    });
    expect(splitAddress("Knollendamstraat 5hs")).toEqual({
      straat: "Knollendamstraat",
      huisnummer: "5",
      toevoeging: "hs",
    });
    expect(splitAddress("Binnen Oranjestraat 9-H")).toEqual({
      straat: "Binnen Oranjestraat",
      huisnummer: "9",
      toevoeging: "H",
    });
    expect(splitAddress("Marktplein")).toEqual({
      straat: "Marktplein",
      huisnummer: "",
      toevoeging: "",
    });
  });

  it("toont locatieregels met naam en volledig adres", () => {
    expect(
      formatLocationLine({
        naam: "A",
        adres: "Tolstraat 91",
        postcode: "1074 VK",
        plaats: "Amsterdam",
      }),
    ).toBe("A — Tolstraat 91, 1074 VK Amsterdam");
  });

  it("neemt alle contactpersonen mee zonder dubbel primair record", () => {
    const m = member({
      id: 3,
      contactpersoon: "Jan Jansen",
      functie: "Eigenaar",
      email: "jan@shop.nl",
      telefoon: "0612345678",
      contacten: [
        {
          naam: "Jan Jansen",
          functie: "Eigenaar",
          telefoon: "0612345678",
          email: "jan@shop.nl",
        },
        {
          naam: "Piet Pietersen",
          functie: "Manager",
          telefoon: "0687654321",
          email: "piet@shop.nl",
        },
      ],
    });
    const contacts = effectiveContacts(m);
    expect(contacts).toHaveLength(2);
    expect(contacts[0].primair).toBe(true);
    const rows = buildContactRows([m]);
    expect(rows.map((r) => r.primair)).toEqual(["Ja", "Nee"]);
    expect(rows.map((r) => r.nr)).toEqual([1, 2]);
  });

  it("neemt de hoofdvelden op als er geen contactenlijst is", () => {
    const rows = buildContactRows([
      member({ id: 4, contactpersoon: "Alleen Hoofd", email: "a@b.nl" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ naam: "Alleen Hoofd", primair: "Ja" });
  });

  it("bouwt alle drie de bladen consistent", () => {
    const data = buildWorkbookData([
      member({
        id: 2,
        contactpersoon: "B",
        locaties: [{ naam: "L2", adres: "Straat 2", plaats: "Utrecht" }],
      }),
      member({
        id: 1,
        contactpersoon: "A",
        locaties: [{ naam: "L1", adres: "Straat 1", plaats: "Utrecht" }],
      }),
    ]);
    expect(data.leden.map((r) => r.lidnr)).toEqual([1, 2]);
    expect(data.locaties.map((r) => r.lidnr)).toEqual([1, 2]);
    expect(data.contacten.map((r) => r.lidnr)).toEqual([1, 2]);
  });

  it("gebruikt de juiste bestandsnaam", () => {
    expect(exportFileName(new Date("2026-09-21T10:00:00Z"))).toBe(
      "bcd-leden-2026-09-21.xlsx",
    );
  });
});
