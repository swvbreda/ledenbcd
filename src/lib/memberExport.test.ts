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
    const locaties = buildLocatieRows([{ type: "Lid", members: [m] }]);
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
    const rows = buildLocatieRows([
      { type: "Lid", members: [member({ id: 7, locaties: merged })] },
    ]);
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
    const rows = buildContactRows([{ type: "Lid", members: [m] }]);
    expect(rows.map((r) => r.primair)).toEqual(["Ja", "Nee"]);
    expect(rows.map((r) => r.nr)).toEqual([1, 2]);
  });

  it("neemt de hoofdvelden op als er geen contactenlijst is", () => {
    const rows = buildContactRows([
      {
        type: "Lid",
        members: [
          member({ id: 4, contactpersoon: "Alleen Hoofd", email: "a@b.nl" }),
        ],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ naam: "Alleen Hoofd", primair: "Ja" });
  });

  it("bouwt alle bladen consistent", () => {
    const data = buildWorkbookData({
      leden: [
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
      ],
      leads: [],
      oudLeden: [],
    });
    expect(data.leden.map((r) => r.lidnr)).toEqual([1, 2]);
    expect(data.locaties.map((r) => r.lidnr)).toEqual([1, 2]);
    expect(data.contacten.map((r) => r.lidnr)).toEqual([1, 2]);
  });

  it("verdeelt leden, leads en oud-leden over eigen bladen en telt op tot 131", () => {
    const make = (start: number, count: number) =>
      Array.from({ length: count }, (_, i) =>
        member({
          id: start + i,
          naam: `Record ${start + i}`,
          contactpersoon: `C${start + i}`,
          locaties: [
            { naam: `L${start + i}`, adres: `Straat ${start + i}`, plaats: "X" },
          ],
        }),
      );
    const data = buildWorkbookData({
      leden: make(1, 116),
      leads: make(200, 10),
      oudLeden: make(300, 5),
    });
    expect(data.leden).toHaveLength(116);
    expect(data.leads).toHaveLength(10);
    expect(data.oudLeden).toHaveLength(5);
    expect(data.leden.length + data.leads.length + data.oudLeden.length).toBe(
      131,
    );
    expect(data.leden[0].nr).toBe(1);
    expect(data.leads[0].nr).toBe(1);
    expect(data.oudLeden[0].nr).toBe(1);
    expect(data.oudLeden.map((r) => r.lidnr)).toEqual([300, 301, 302, 303, 304]);
    // Locaties en contactpersonen bevatten alle drie de categorieën met Type.
    expect(data.locaties).toHaveLength(131);
    expect(data.contacten).toHaveLength(131);
    expect(new Set(data.locaties.map((r) => r.type))).toEqual(
      new Set(["Lid", "Lead", "Oud-lid"]),
    );
    expect(data.locaties.filter((r) => r.type === "Oud-lid")).toHaveLength(5);
    expect(data.contacten.filter((r) => r.type === "Lead")).toHaveLength(10);
    expect(data.locaties[0].type).toBe("Lid");
    expect(data.locaties.map((r) => r.nr)).toEqual(
      data.locaties.map((_, i) => i + 1),
    );
  });

  it("past de effectieve merge ook op oud-leden toe en laat verwijderde locaties weg", () => {
    const merged = mergeMemberLocations(
      [
        { naam: "A", adres: "Tolstraat 91", postcode: "1074 VK", plaats: "Amsterdam" },
        { naam: "Oud", adres: "Kerkstraat 2", postcode: "1017 GG", plaats: "Amsterdam" },
      ],
      [],
      ["locatie:1017GG|kerkstraat2"],
    );
    const data = buildWorkbookData({
      leden: [],
      leads: [],
      oudLeden: [member({ id: 9, locaties: merged })],
    });
    expect(data.oudLeden).toHaveLength(1);
    expect(data.locaties).toHaveLength(1);
    expect(data.locaties[0]).toMatchObject({
      type: "Oud-lid",
      locatienaam: "A",
    });
  });

  it("gebruikt de juiste bestandsnaam", () => {
    expect(exportFileName(new Date("2026-09-21T10:00:00Z"))).toBe(
      "bcd-leden-2026-09-21.xlsx",
    );
  });
});
