import { describe, expect, it } from "vitest";
import { isSafePublicUrl, parsePreview } from "../linkPreview";

describe("link preview", () => {
  it("blocks internal and private addresses", () => {
    for (const u of ["http://localhost/x", "http://127.0.0.1/", "http://192.168.1.1/", "http://10.0.0.5/", "ftp://a.nl/", "https://a.nl:8443/", "http://[::1]/"])
      expect(isSafePublicUrl(u)).toBeNull();
    expect(isSafePublicUrl("https://www.coffeeshopbond.nl/nieuws")).not.toBeNull();
  });
  it("reads og title and absolute https image", () => {
    const p = parsePreview('<meta property="og:title" content="Feest &amp; jubileum"><meta property="og:image" content="/img.jpg">', "https://bcd.nl/a");
    expect(p.title).toBe("Feest & jubileum");
    expect(p.image).toBe("https://bcd.nl/img.jpg");
  });
});
