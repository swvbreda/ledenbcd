import { describe, it, expect } from "vitest";
import { buildVerloopSeries } from "./verloop";

const m = (lidSinds: number | null) => ({ lidSinds, lidJaren: undefined });

describe("buildVerloopSeries", () => {
  it("baseert het huidige aantal op de geladen lijst", () => {
    const res = buildVerloopSeries([m(2020), m(2021), m(2022)], 2026);
    expect(res.current).toBe(3);
    expect(res.data[res.data.length - 1]).toEqual({ year: 2026, leden: 3 });
  });

  it("bouwt een cumulatieve historie op", () => {
    const res = buildVerloopSeries([m(2024), m(2025)], 2026);
    expect(res.data).toEqual([
      { year: 2024, leden: 1 },
      { year: 2025, leden: 2 },
      { year: 2026, leden: 2 },
    ]);
  });

  it("markeert de historie als onbetrouwbaar bij te weinig startjaren", () => {
    const res = buildVerloopSeries([m(2020), m(null), m(null)], 2026);
    expect(res.reliable).toBe(false);
    expect(res.data).toEqual([]);
    expect(res.current).toBe(3);
  });

  it("geeft geen historie bij een lege lijst", () => {
    const res = buildVerloopSeries([], 2026);
    expect(res.current).toBe(0);
    expect(res.reliable).toBe(false);
  });

  it("negeert startjaren in de toekomst", () => {
    const res = buildVerloopSeries([m(2030), m(2024), m(2024), m(2024), m(2024)], 2026);
    expect(res.reliable).toBe(true);
    expect(res.data[0]).toEqual({ year: 2024, leden: 4 });
  });
});
