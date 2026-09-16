import { describe, expect, it } from "vitest";
import { linkifyParts } from "./linkify";

describe("linkifyParts", () => {
  it("herkent een url midden in een zin", () => {
    const parts = linkifyParts("Bestel via https://leapnl.weticket.io/clean vandaag");
    expect(parts.filter((p) => p.type === "link")).toEqual([
      { type: "link", value: "https://leapnl.weticket.io/clean", href: "https://leapnl.weticket.io/clean" },
    ]);
  });

  it("laat afsluitend leesteken buiten de link", () => {
    const parts = linkifyParts("(https://www.gofundme.com/f/help-uit).");
    const link = parts.find((p) => p.type === "link");
    expect(link).toEqual({
      type: "link",
      value: "https://www.gofundme.com/f/help-uit",
      href: "https://www.gofundme.com/f/help-uit",
    });
  });

  it("herkent een domein zonder https", () => {
    const parts = linkifyParts("kijk op leapnl.weticket.io/filmvertoning");
    expect(parts.find((p) => p.type === "link")?.href).toBe(
      "https://leapnl.weticket.io/filmvertoning",
    );
  });

  it("maakt een mailto van een e-mailadres", () => {
    const parts = linkifyParts("mail naar info@coffeeshopbond.nl graag");
    expect(parts.find((p) => p.type === "link")?.href).toBe("mailto:info@coffeeshopbond.nl");
  });

  it("laat gewone tekst ongemoeid", () => {
    expect(linkifyParts("geen link hier")).toEqual([{ type: "text", value: "geen link hier" }]);
  });
});
