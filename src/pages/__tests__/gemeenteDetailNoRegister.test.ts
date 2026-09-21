import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/pages/GemeenteDetailPage.tsx", "utf8");

describe("GemeenteDetailPage", () => {
  it("bevat geen verwijzing naar het coffeeshopregister", () => {
    expect(source.toLowerCase()).not.toContain("coffeeshopregister");
    expect(source.toLowerCase()).not.toContain("register");
  });

  it("toont nog wel de aangesloten ledenlocaties", () => {
    expect(source).toContain("Aangesloten coffeeshops");
  });
});
