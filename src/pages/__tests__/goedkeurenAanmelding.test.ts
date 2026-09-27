import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/GoedkeuringenPage.tsx", "utf8");

/**
 * Een aanmelding van de publieke site afhandelen is een besluit, geen
 * administratieve handeling. De knop moet daarom zeggen wat hij doet:
 * goedkeuren betekent dat het bijbehorende record lid wordt.
 */
describe("Goedkeuren van een aanmelding", () => {
  it("biedt een duidelijke goedkeurknop in plaats van alleen maar markeren", () => {
    expect(source).toContain(">Goedkeuren<");
    expect(source).toContain("openGoedkeur(s, existing)");
    expect(source).not.toContain("Alleen markeren");
    expect(source).not.toContain("gemarkeerd als verwerkt");
  });

  it("zet een lead bij goedkeuren daadwerkelijk om naar een lidmaatschap", () => {
    expect(source).toContain('import { convertLead } from "@/hooks/useLeadConversions"');
    expect(source).toContain("leadId: existing.m.id");
    expect(source).toContain('existing.type === "member"');
  });

  it("maakt bij een onbekende shop alsnog een ledenrecord aan", () => {
    expect(source).toContain('if (!existing) {');
    expect(source).toContain("handleAddAsMember(signup)");
    expect(source).toContain('insert({ id: nextId, member_type: "member", data })');
  });

  it("vraagt bevestiging en noolt de contributievrijstelling vóór de klik", () => {
    expect(source).toContain("<AlertDialog");
    expect(source).toContain("contribution_exemptions");
    expect(source).toContain("Geen contributiefactuur voor");
    expect(source).toContain("<AlertDialogCancel>Annuleren</AlertDialogCancel>");
  });

  it("laat een geweigerde aanmelding gewoon wegkomen", () => {
    expect(source).toContain('status: "rejected"');
    expect(source).toContain(">Afwijzen");
  });
});
