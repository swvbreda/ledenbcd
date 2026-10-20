import { describe, expect, it } from "vitest";
import { visibleMemberRows } from "@/lib/memberDirectory";

const rows = [
  { id: 1, member_type: "member", data: {} },
  { id: 2, member_type: "lead", data: {} },
  { id: 3, member_type: "old", data: {} },
  { id: 4, member_type: "member", data: {} },
];
describe("lead visibility and canonical member totals", () => {
  it("ordinary members never receive lead rows", () => {
    expect(visibleMemberRows(rows, false).map((r) => r.id)).toEqual([1, 3, 4]);
  });
  it("internal readers retain leads", () => {
    expect(visibleMemberRows(rows, true).map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });
  it("member total excludes leads and archived members", () => {
    expect(visibleMemberRows(rows, true).filter((r) => r.member_type === "member")).toHaveLength(2);
  });
});