import { describe, it, expect } from "vitest";
import { stickerRequests, legacyCoffeeshop, stickerCsv, stickerPrefill, ONBEKEND } from "../stickerRequests";

const qs = ["Vest", "Jaren", "Ontvanger", "Straatnaam", "Huisnummer", "Toevoeging", "Postcode", "Plaats"].map((t, i) => ({ id: `q${i}`, question_text: t, sort_order: i }));
const legacy = (ts: string, jaren: string[], text: string) => [
  { question_id: "q1", submitted_at: ts, answer: { value: jaren, source: "WhatsApp BCD Leden", aanvrager: text.split(" — ")[0] } },
  { question_id: "q2", submitted_at: ts, answer: { value: text, source: "WhatsApp BCD Leden", aanvrager: text.split(" — ")[0] } },
];

describe("stickeraanvragen", () => {
  it("oude WhatsApp-inzending: bekende shop, rest expliciet onbekend", () => {
    const [r] = stickerRequests(qs, legacy("t1", [], "Edwin Bax — De Ambassade, Zwijndrecht (jaartallen nog te bevestigen)"));
    expect(r).toMatchObject({ aanvrager: "Edwin Bax", coffeeshop: "De Ambassade, Zwijndrecht", jaren: ONBEKEND, vestigingen: ONBEKEND, ontvanger: ONBEKEND, postcode: ONBEKEND });
  });
  it("vestiging nog te bevestigen wordt onbekend, niet verzonnen", () => {
    expect(legacyCoffeeshop("Rachid — vestiging nog te bevestigen")).toBe("");
    expect(legacyCoffeeshop("Martijn Vree — Superfly, vestiging nog te bevestigen")).toBe("Superfly");
  });
  it("nieuwe aanvraag: één rij met naam, coffeeshop, jaren, vestigingen en adres apart van ontvanger", () => {
    const a = (q: string, value: unknown) => ({ question_id: q, submitted_at: "t2", answer: { value, aanvrager: "Piet", coffeeshop: "De Shop", request_id: "r1", source: "Ledenportaal" } });
    const rows = stickerRequests(qs, [a("q0", "1"), a("q1", ["2025", "2026"]), a("q2", "Jan"), a("q3", "Damrak"), a("q4", "12"), a("q5", ""), a("q6", "1012 AB"), a("q7", "Amsterdam"), ...legacy("t1", ["2026"], "Rachid — vestiging nog te bevestigen")]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.key === "r1")).toMatchObject({ aanvrager: "Piet", coffeeshop: "De Shop", jaren: "2025, 2026", vestigingen: "1", ontvanger: "Jan", straat: "Damrak", plaats: "Amsterdam", toevoeging: "" });
    expect(stickerCsv(rows).split("\n")).toHaveLength(3);
  });
  it("twee vestigingen van één account geven twee aparte rijen met eigen vestiging", () => {
    const a = (req: string, loc: string) => ({ question_id: "q0", submitted_at: "t3", answer: { value: "1", aanvrager: "Piet", coffeeshop: "Groep", location: loc, request_id: req } });
    const rows = stickerRequests(qs, [a("r1", "Shop A (Utrecht)"), a("r2", "Shop B (Zeist)")]);
    expect(rows.map((r) => r.vestiging)).toEqual(["Shop A (Utrecht)", "Shop B (Zeist)"]);
  });
  it("vooraf invullen alleen bij eenduidige gegevens", () => {
    const m = { naam: "De Shop", contacten: [{ naam: "Piet", email: "p@x.nl" }] };
    expect(stickerPrefill("P@x.nl", [m])).toEqual({ aanvrager: "Piet", coffeeshop: "De Shop" });
    expect(stickerPrefill("p@x.nl", [m, { naam: "Ander", contacten: [{ naam: "Klaas", email: "p@x.nl" }] }])).toEqual({ aanvrager: "", coffeeshop: "" });
  });
});
