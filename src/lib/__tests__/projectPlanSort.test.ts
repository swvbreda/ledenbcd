import { describe, expect, it } from "vitest";
import { newestFirst, parsePlan } from "../projectPlan";

describe("Verloop nieuwste eerst (weergave)", () => {
  it("PCN: 9 regels oud-naar-nieuw, 6 okt 2026 bovenaan, 21 nov 2025 onderaan, bron ongewijzigd", () => {
    const raw = "Verloop\n21 november 2025 | A | a\n2025-12-03 | B | b\n15-1-2026 | C | c\n2 feb 2026 | D | d\n2026-03-10 | E | e\n1 mei 2026 | F | f\n2026-06-20 | G | g\n3 sept 2026 | H | h\n6 okt 2026 | I | i";
    const items = (parsePlan(raw)[0].blocks[0] as { items: { date: string; title: string }[] }).items;
    const sorted = newestFirst(items);
    expect(sorted.map((x) => x.title)).toEqual(["I", "H", "G", "F", "E", "D", "C", "B", "A"]);
    expect(items.map((x) => x.title)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I"]);
  });
  it("gelijke datum in verschillende vormen behoudt oorspronkelijke volgorde", () => {
    const s = newestFirst([{ date: "2026-10-06", t: 1 }, { date: "6-10-2026", t: 2 }, { date: "6 oktober 2026", t: 3 }, { date: "1 jan 2026", t: 4 }]);
    expect(s.map((x) => x.t)).toEqual([1, 2, 3, 4]);
  });
});
