import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  shouldStartYearSync,
  lastSuccessfulYearSyncAt,
  YEAR_SYNC_STALE_MS,
  type SyncLogRow,
} from "@/lib/ledgerSync";

const now = new Date("2026-09-19T22:00:00Z").getTime();
const fresh = new Date(now - 60_000).toISOString();
const stale = new Date(now - 60 * 60_000).toISOString();

const row = (over: Partial<SyncLogRow>): SyncLogRow => ({
  action: "sync_year",
  success: true,
  run_at: fresh,
  details: { year: 2026 },
  ...over,
});

describe("ledgerSync", () => {
  it("filtert op details.year", () => {
    const log = [row({ details: { year: 2025 }, run_at: fresh }), row({ run_at: stale })];
    expect(lastSuccessfulYearSyncAt(log, 2026)).toBe(stale);
    expect(lastSuccessfulYearSyncAt(log, 2025)).toBe(fresh);
    expect(lastSuccessfulYearSyncAt(log, 2024)).toBeNull();
  });

  it("negeert logs zonder details.year", () => {
    expect(lastSuccessfulYearSyncAt([row({ details: null })], 2026)).toBeNull();
  });

  it("start als er nog geen jaarsync is", () => {
    expect(shouldStartYearSync({ log: [], year: 2026, now })).toBe(true);
  });

  it("start als de laatste jaarsync ouder is dan 15 minuten", () => {
    expect(shouldStartYearSync({ log: [row({ run_at: stale })], year: 2026, now })).toBe(true);
    expect(YEAR_SYNC_STALE_MS).toBe(15 * 60 * 1000);
  });

  it("start niet bij een verse jaarsync", () => {
    expect(shouldStartYearSync({ log: [row({})], year: 2026, now })).toBe(false);
  });

  it("start niet als er al een request loopt", () => {
    expect(shouldStartYearSync({ log: [], year: 2026, now, inFlight: true })).toBe(false);
  });

  it("herhaalt na een fout pas bij de volgende intervalcontrole", () => {
    const attempt = now - 1000;
    expect(shouldStartYearSync({ log: [], year: 2026, now, lastAttemptAt: attempt })).toBe(false);
    expect(
      shouldStartYearSync({ log: [], year: 2026, now: now + YEAR_SYNC_STALE_MS, lastAttemptAt: attempt }),
    ).toBe(true);
  });

  it("wacht tot de logs geladen zijn", () => {
    expect(shouldStartYearSync({ log: [], year: 2026, now, logLoaded: false })).toBe(false);
  });

  it("toont geen handmatige volledige-jaarsyncknop meer", () => {
    const src = readFileSync("src/components/budget/ControleSyncTab.tsx", "utf8");
    expect(src).not.toContain("Volledig jaar ophalen");
    expect(src).not.toContain("RefreshCw");
    expect(src).toContain("Het volledige boekjaar wordt automatisch bijgewerkt.");
  });
});
