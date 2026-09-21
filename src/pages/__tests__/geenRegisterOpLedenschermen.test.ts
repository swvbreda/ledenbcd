import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("registervermeldingen buiten de registerpagina", () => {
  it("de gemeentepagina toont geen registerdekkingsblok", () => {
    const source = read("src/pages/LocatiesPage.tsx");
    expect(source).not.toContain("RegisterCoverageCard");
    expect(source.toLowerCase()).not.toContain("aansluiting op het register");
  });

  it("de vertegenwoordigingspagina linkt niet naar het register", () => {
    expect(read("src/pages/MarktaandeelPage.tsx")).not.toContain("/coffeeshopregister/gemeente/");
  });

  it("goedkeuringen toont geen koppelvoorstellen uit het register", () => {
    expect(read("src/pages/GoedkeuringenPage.tsx")).not.toContain("RegisterLinkApprovals");
  });

  it("het ledendetail toont geen registerkoppelingen of registerstatussen", () => {
    const source = read("src/pages/MemberDetail.tsx");
    expect(source).not.toContain("<LocationRegisterInfo");
    expect(source).not.toContain("Alleen in register");
    expect(source).not.toContain("canSeeRegister");
  });

  it("de registerpagina zelf blijft bestaan", () => {
    expect(read("src/pages/CoffeeshopRegisterPage.tsx")).toContain("RegisterEnrichmentPanel");
    expect(read("src/components/AppSidebar.tsx")).toContain("/coffeeshopregister");
  });
});
