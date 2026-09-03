import { describe, expect, it } from "vitest";
import { matchParticipants } from "@/lib/communityMatch";
import type { Member } from "@/data/types";

const member = (m: Partial<Member> & { id: number }): Member =>
  ({ locaties: [], contacten: [], ...m }) as Member;

const members: Member[] = [
  member({ id: 39, naam: "Thunderbird", contactpersoon: "Michael Jansen" }),
  member({ id: 71, naam: "Blue Tomato", contactpersoon: "Michael de Boer" }),
  member({ id: 16, naam: "De Os", locaties: [{ naam: "Caramba" }], contactpersoon: "Guus Bakker" }),
  member({
    id: 12,
    naam: "De Molen",
    contactpersoon: "Tim de Wilde",
    telefoon: "06-12345678",
  }),
];

const p = (id: string, name: string, phone: string | null = null) => ({
  id,
  display_name: name,
  phone,
  member_id: null,
});

describe("matchParticipants", () => {
  it("koppelt zeker op telefoonnummer", () => {
    const { certain } = matchParticipants([p("a", "Onbekend", "+31612345678")], members);
    expect(certain.map((c) => c.memberId)).toEqual([12]);
  });

  it("gebruikt de shopnaam in de weergavenaam om de juiste Michael te kiezen", () => {
    const { suggested } = matchParticipants([p("b", "Michael Coffeeshop Thunderbird")], members);
    expect(suggested[0].candidates[0].memberId).toBe(39);
    expect(suggested[0].isClear).toBe(true);
  });

  it("herkent een vestigingsnaam van een lid", () => {
    const { suggested } = matchParticipants([p("c", "Guus Coffeeshop Caramba")], members);
    expect(suggested[0].candidates[0].memberId).toBe(16);
  });

  it("laat een voornaam met meerdere kandidaten staan als keuze", () => {
    const { suggested } = matchParticipants([p("d", "Michael")], members);
    expect(suggested[0].candidates.length).toBeGreaterThan(1);
    expect(suggested[0].isClear).toBe(false);
  });

  it("matcht voor- en achternaam van een contactpersoon", () => {
    const { suggested } = matchParticipants([p("e", "Tim de Wilde")], members);
    expect(suggested[0].candidates[0].memberId).toBe(12);
  });
});
