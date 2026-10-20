import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderWhatsAppText, plainWhatsAppText } from "../whatsappFormat";

const html = (t: string) => renderToStaticMarkup(<>{renderWhatsAppText(t)}</>);

describe("WhatsApp formatting", () => {
  it("renders *text* as bold", () => {
    expect(html("Hallo *iedereen* daar")).toBe("Hallo <strong>iedereen</strong> daar");
  });
  it("makes links clickable without trailing punctuation", () => {
    expect(html("Zie https://bcd.nl/x.")).toBe('Zie <a href="https://bcd.nl/x" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2 break-all">https://bcd.nl/x</a>.');
  });
  it("escapes html instead of injecting it", () => {
    expect(html("<b>x</b>")).toBe("&lt;b&gt;x&lt;/b&gt;");
  });
  it("strips markers from titles", () => {
    expect(plainWhatsAppText("*Goedenavond allen!*")).toBe("Goedenavond allen!");
  });
});
