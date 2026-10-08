import { describe, expect, it } from "vitest";
import { computeOpenTotals, isOpenDeclaration, paymentLabel, type OpenTotalInput } from "../declarationOpenTotals";

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

import { formOpenNote } from "@/lib/declarationOpenTotals";
describe("formOpenNote", () => {
  const rows: any[] = [
    { year: 2026, amount: 18.17, status: "pending", paid_at: null, submitted_by: "u1", board_member_id: "b1", board_member_name: "Simone" },
    { year: 2026, amount: 10, status: "approved", paid_at: null, submitted_by: "u1", board_member_id: "b1", board_member_name: "Simone" },
    { year: 2026, amount: 99, status: "pending", paid_at: null, submitted_by: "u2", board_member_id: "b2", board_member_name: "Bernard" },
  ];
  const simone = { id: "b1", naam: "Simone" }, bernard = { id: "b2", naam: "Bernard" };
  it("admin met gekozen ander bestuurslid krijgt diens cijfers", () => {
    const t = computeOpenTotals(rows, { year: 2026, isAdmin: true, userId: "u1" });
    expect(formOpenNote(t, { year: 2026, isAdmin: true, member: bernard })).toMatch(/voor Bernard al 1 open declaratie \(€\s?99,00\)/);
  });
  it("admin met zichzelf gekozen krijgt alleen eigen cijfers", () => {
    const t = computeOpenTotals(rows, { year: 2026, isAdmin: true, userId: "u1" });
    expect(formOpenNote(t, { year: 2026, isAdmin: true, member: simone })).toMatch(/voor Simone al 2 open declaraties \(€\s?28,17\)/);
  });
  it("zonder gekozen bestuurslid: algemeen, admin over alle bestuurders", () => {
    const t = computeOpenTotals(rows, { year: 2026, isAdmin: true, userId: "u1" });
    expect(formOpenNote(t, { year: 2026, isAdmin: true })).toMatch(/3 open declaraties.*over alle bestuurders/);
  });
  it("gewone gebruiker ziet bij een ander bestuurslid geen cijfers van die ander", () => {
    const t = computeOpenTotals(rows, { year: 2026, isAdmin: false, userId: "u1" });
    expect(formOpenNote(t, { year: 2026, isAdmin: false, member: bernard })).toBeNull();
  });
});

describe("beheerdersbevestiging betaald", () => {
  const b0 = { year: 2026, amount: 85.56, status: "approved", paid_at: null, bank_transaction_id: null, submitted_by: "u", board_member_id: "bernard", board_member_name: "Bernard" };
  it("telt bevestigde declaratie niet meer als open", () => {
    expect(isOpenDeclaration({ ...b0, payment_confirmed_at: "2026-10-08T22:10:00Z" })).toBe(false);
    expect(computeOpenTotals([{ ...b0, payment_confirmed_at: "2026-10-08T22:10:00Z" }], { year: 2026, isAdmin: true, userId: "a" }).cents).toBe(0);
  });
  it("andere persoon of toekomstige declaratie zonder bevestiging blijft open", () => {
    expect(isOpenDeclaration({ ...b0, board_member_name: "Joachim" })).toBe(true);
  });
  it("label onderscheidt bank en bevestiging; bank gaat voor", () => {
    expect(paymentLabel({ ...b0, payment_confirmed_at: "x" })).toBe("betaald_bevestigd");
    expect(paymentLabel({ ...b0, paid_at: "2026-02-25", bank_transaction_id: "t" })).toBe("bank_gekoppeld");
    expect(paymentLabel(b0)).toBe(null);
  });
});
