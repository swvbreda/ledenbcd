import type { Member } from "@/data/types";

type MemberYearsSource = Pick<Member, "lidSinds" | "lidJaren">;

const BOND_START_YEAR = 1994;

const getStartYearFromFactuurJaren = (lidJaren?: number[]): number | null => {
  if (!Array.isArray(lidJaren) || lidJaren.length === 0) return null;

  const validYears = lidJaren.filter((year) => Number.isInteger(year));
  if (validYears.length === 0) return null;

  return Math.min(...validYears);
};

export const getMembershipYears = (member: MemberYearsSource): number | null => {
  const startYear =
    typeof member.lidSinds === "number"
      ? member.lidSinds
      : getStartYearFromFactuurJaren(member.lidJaren);

  if (startYear === null) return null;

  const currentYear = new Date().getFullYear();
  if (startYear > currentYear) return null;

  // Cap at bond founding year — nobody can be a member longer than the bond exists
  const effectiveStart = Math.max(startYear, BOND_START_YEAR);
  return currentYear - effectiveStart;
};
