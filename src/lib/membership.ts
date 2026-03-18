import type { Member } from "@/data/types";

type MemberYearsSource = Pick<Member, "jarenLid" | "lidSinds">;

const BOND_START_YEAR = 1994;

const clampToBondLifetime = (years: number): number | null => {
  if (years < 0) return null;

  const currentYear = new Date().getFullYear();
  const maxBondYears = Math.max(0, currentYear - BOND_START_YEAR);

  return Math.min(years, maxBondYears);
};

export const getMembershipYears = (member: MemberYearsSource): number | null => {
  if (typeof member.lidSinds === "number") {
    const currentYear = new Date().getFullYear();
    const effectiveStartYear = Math.max(member.lidSinds, BOND_START_YEAR);
    return clampToBondLifetime(currentYear - effectiveStartYear);
  }

  if (typeof member.jarenLid === "number") {
    return clampToBondLifetime(member.jarenLid);
  }

  return null;
};
