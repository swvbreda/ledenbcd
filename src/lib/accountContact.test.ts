import { describe, expect, it } from "vitest";
import type { Member } from "@/data/types";
import { findAccountContact, normalizeEmailList, renameMatchedContact } from "@/lib/accountContact";

const member = {
  contactpersoon: "Bart van der Vlugt",
  email: "bart@clubhome.nl; ericschaay@gmail.com",
  contacten: [
    { naam: "Bart van der Vlugt", functie: "Eigenaar", telefoon: "", email: "bart@clubhome.nl" },
    { naam: "Chakib Tayeb", functie: "Bedrijfsleider", telefoon: "", email: "chakib@theborder.nl  " },
  ],
} as Member;

describe("account-contactkoppeling", () => {
  it("normaliseert spaties en meerdere e-mailadressen", () => {
    expect(normalizeEmailList(" A@EXAMPLE.NL; b@example.nl / c@example.nl ")).toEqual([
      "a@example.nl",
      "b@example.nl",
      "c@example.nl",
    ]);
  });

  it("vindt Chakib ondanks afsluitende spaties zonder terug te vallen op Bart", () => {
    expect(findAccountContact(member, "chakib@theborder.nl")).toEqual({
      kind: "contact",
      name: "Chakib Tayeb",
      index: 1,
    });
  });

  it("wijzigt alleen de gematchte contactpersoon", () => {
    const match = findAccountContact(member, "chakib@theborder.nl");
    expect(match).not.toBeNull();
    if (!match) return;

    const update = renameMatchedContact(member, match, "Chakib T.");
    expect("contacten" in update ? update.contacten.map((contact) => contact.naam) : []).toEqual([
      "Bart van der Vlugt",
      "Chakib T.",
    ]);
    expect(member.contactpersoon).toBe("Bart van der Vlugt");
  });
});