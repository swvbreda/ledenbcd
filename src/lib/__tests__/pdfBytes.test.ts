import { describe, it, expect } from "vitest";
import { copyPdfBytes } from "@/lib/pdfBytes";

// Simuleert wat pdf.js doet: de buffer naar de worker overdragen (detach).
const transfer = (u: Uint8Array) => structuredClone(u.buffer, { transfer: [u.buffer] });

describe("copyPdfBytes", () => {
  it("herhaald laden blijft werken nadat een kopie is overgedragen", () => {
    const src = new Uint8Array([37, 80, 68, 70, 45, 49]); // "%PDF-1"
    for (let i = 0; i < 3; i++) {
      const copy = copyPdfBytes(src);
      transfer(copy);
      expect(copy.byteLength).toBe(0); // kopie is detached
      expect(Array.from(src)).toEqual([37, 80, 68, 70, 45, 49]); // bron intact
    }
  });
  it("respecteert byteOffset/length van een subview", () => {
    const backing = new Uint8Array([0, 0, 37, 80, 68, 70, 9, 9]);
    const view = backing.subarray(2, 6);
    const copy = copyPdfBytes(view);
    expect(Array.from(copy)).toEqual([37, 80, 68, 70]);
    expect(copy.buffer).not.toBe(backing.buffer);
  });
  it("kopieert een losse ArrayBuffer", () => {
    const buf = new Uint8Array([1, 2, 3]).buffer;
    const copy = copyPdfBytes(buf);
    transfer(copy);
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
  });
});
