import { describe, expect, it } from "vitest";
import { lastSuccessfulYearSync, syncSucceededSince } from "../ledgerSync";

// Vorm zoals de database hem teruggeeft (live log 2026-10-09).
const row = (run_at: string, year: unknown, success = true) => ({ action: "sync_year", success, run_at, items_processed: 161, details: { year, per_type: { purchase_invoice: 150 } } });

describe("laatste jaarsync op details.year", () => {
  it("vindt live-rij 2026 (161 regels)", () => {
    const r = lastSuccessfulYearSync([row("2026-10-09T22:03:20.106686+00:00", 2026)], 2026);
    expect(r?.items_processed).toBe(161);
  });
  it("jaar als tekst telt ook", () => expect(lastSuccessfulYearSync([row("2026-10-09T22:03:20Z", "2026")], 2026)).not.toBeNull());
  it("sync van ander jaar telt niet", () => expect(lastSuccessfulYearSync([row("2026-10-09T22:03:20Z", 2025)], 2026)).toBeNull());
  it("mislukte sync telt niet", () => expect(lastSuccessfulYearSync([row("2026-10-09T22:03:20Z", 2026, false)], 2026)).toBeNull());
});

describe("sync bevestigd na time-out", () => {
  const start = Date.parse("2026-10-09T22:01:30Z");
  it("geslaagde log na start: doorgaan", () => expect(syncSucceededSince([row("2026-10-09T22:03:20Z", 2026)], 2026, start)).not.toBeNull());
  it("alleen oudere log: niet doorgaan", () => expect(syncSucceededSince([row("2026-10-09T21:45:57Z", 2026)], 2026, start)).toBeNull());
  it("na start alleen ander jaar: niet doorgaan", () => expect(syncSucceededSince([row("2026-10-09T22:03:20Z", 2025)], 2026, start)).toBeNull());
});
