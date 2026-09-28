import { expect, it } from "vitest";
import { eligibleMemberId } from "./memberAccessPolicy";

it("permits one active explicitly matched member including additional contacts", () => {
  expect(eligibleMemberId("extra@example.test", [{ memberId: 100, active: true }])).toBe(100);
});
it("fails closed for unknown, inactive, ambiguous, or unnormalized addresses", () => {
  expect(eligibleMemberId("unknown@example.test", [])).toBeNull();
  expect(eligibleMemberId("old@example.test", [{ memberId: 100, active: false }])).toBeNull();
  expect(eligibleMemberId("both@example.test", [{ memberId: 1, active: true }, { memberId: 2, active: true }])).toBeNull();
  expect(eligibleMemberId(" X@example.test ", [{ memberId: 100, active: true }])).toBeNull();
});
