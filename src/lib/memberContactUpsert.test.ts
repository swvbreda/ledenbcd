import { describe, expect, it } from "vitest";
import { buildMemberContactPatch, isPhoneKnown } from "./memberContactUpsert";
import type { Member } from "@/data/types";

const base = {
  id: 1,
  naam: "Coffeeshop Test",
  plaats: "Amsterdam",
  stadsdeel: "",
  jarenLid: null,
  oprichtingJaar: null,
  contactpersoon: "",
  functie: "",
  telefoon: "",
  email: "",
  bedrijfsnaam: "Test BV",
  aantalLocaties: 0,
  locaties: [],
  contacten: [],
} as Member;

describe("memberContactUpsert", () => {
  it("voegt een contactpersoon toe", () => {
    const patch = buildMemberContactPatch(
      base,
      { naam: "Jan Jansen", telefoon: "0612345678" },
      "contact",
    );
    expect(patch?.contacten).toHaveLength(1);
    expect(patch?.contacten?.[0]).toMatchObject({
      naam: "Jan Jansen",
      telefoon: "0612345678",
      functie: "Community",
    });
  });

  it("werkt het hoofdtelefoonnummer bij", () => {
    const patch = buildMemberContactPatch(
      base,
      { naam: "Jan Jansen", telefoon: "0612345678" },
      "primary",
    );
    expect(patch).toMatchObject({ telefoon: "0612345678", contactpersoon: "Jan Jansen" });
  });

  it("slaat niets op als het contact al identiek bekend is", () => {
    const member = {
      ...base,
      contacten: [{ naam: "Jan Jansen", functie: "Eigenaar", telefoon: "06 12 34 56 78", email: "j@x.nl" }],
    } as Member;
    expect(
      buildMemberContactPatch(member, { naam: "Jan Jansen", telefoon: "0612345678" }, "contact"),
    ).toBeNull();
    expect(isPhoneKnown(member, "+31612345678")).toBe(true);
  });

  it("slaat niets op bij modus none", () => {
    expect(buildMemberContactPatch(base, { naam: "Jan", telefoon: "0612345678" }, "none")).toBeNull();
  });
});
