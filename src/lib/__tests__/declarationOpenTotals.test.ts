import { describe, expect, it } from "vitest";
import { computeOpenTotals, type OpenTotalInput } from "../declarationOpenTotals";

const base = (o: Partial<OpenTotalInput>): OpenTotalInput => ({
  year: 2026, amount: 10, status: "pending", paid_at: null, bank_transaction_id: null,
  submitted_by: "u1", board_member_id: "b1", board_member_name: "Simone", ...o,
});

describe("computeOpenTotals", () => {
  it("telt twee losse open declaraties op in centen", () => {
    const r = computeOpenTotals([base({ amount: 18.17 }), base({ amount: 0.1 }), base({ amount: 0.2, status: "approved" })], { year: 2026, isAdmin: false, userId: "u1" });
    expect(r.count).toBe(3);
    expect(r.cents).toBe(1847);
  });
  it("sluit concept, afgewezen en betaald uit", () => {
    const r = computeOpenTotals([
      base({ status: "concept" }), base({ status: "rejected" }),
      base({ paid_at: "2026-01-01" }), base({ bank_transaction_id: "t1" }), base({ amount: 5 }),
    ], { year: 2026, isAdmin: false, userId: "u1" });
    expect(r).toMatchObject({ count: 1, cents: 500 });
  });
  it("alleen gekozen jaar", () => {
    expect(computeOpenTotals([base({ year: 2025 })], { year: 2026, isAdmin: false, userId: "u1" }).count).toBe(0);
  });
  it("niet-admin telt alleen eigen declaraties", () => {
    const r = computeOpenTotals([base({}), base({ submitted_by: "u2" })], { year: 2026, isAdmin: false, userId: "u1" });
    expect(r.count).toBe(1);
  });
  it("admin ziet alles en per bestuurder", () => {
    const r = computeOpenTotals([
      base({ amount: 210 }), base({ amount: 28.06, submitted_by: "u2", board_member_id: "b2", board_member_name: "Bernard" }),
      base({ amount: 19.32, submitted_by: "u2", board_member_id: "b2", board_member_name: "Bernard" }),
    ], { year: 2026, isAdmin: true, userId: "u1" });
    expect(r.cents).toBe(25738);
    expect(r.perMember).toEqual([
      { key: "b1", name: "Simone", count: 1, cents: 21000 },
      { key: "b2", name: "Bernard", count: 2, cents: 4738 },
    ]);
  });
});
