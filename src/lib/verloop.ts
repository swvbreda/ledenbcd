import type { Member } from "@/data/types";

const BOND_START_YEAR = 1994;

export interface VerloopPoint {
  year: number;
  leden: number;
}

export interface VerloopSeries {
  /** Actueel aantal leden uit de daadwerkelijk geladen (RLS-toegestane) lijst. */
  current: number;
  /** Historische reeks, afgeleid uit dezelfde dataset. Leeg als de historie onbetrouwbaar is. */
  data: VerloopPoint[];
  /** Alleen true als de historie betrouwbaar uit dezelfde dataset volgt. */
  reliable: boolean;
  /** Aandeel leden met een bekend startjaar (0-1). */
  coverage: number;
}

type MemberLike = Pick<Member, "lidSinds" | "lidJaren">;

export const getStartYear = (member: MemberLike, currentYear: number): number | null => {
  let start: number | null = null;
  if (typeof member.lidSinds === "number" && Number.isInteger(member.lidSinds)) {
    start = member.lidSinds;
  } else if (Array.isArray(member.lidJaren)) {
    const valid = member.lidJaren.filter((y) => Number.isInteger(y));
    if (valid.length > 0) start = Math.min(...valid);
  }
  if (start === null || start > currentYear) return null;
  return Math.max(start, BOND_START_YEAR);
};

export const buildVerloopSeries = (
  members: MemberLike[],
  currentYear: number = new Date().getFullYear()
): VerloopSeries => {
  const total = members.length;
  const starts = members
    .map((m) => getStartYear(m, currentYear))
    .filter((y): y is number => y !== null);

  const coverage = total > 0 ? starts.length / total : 0;
  const reliable = total > 0 && coverage >= 0.8;

  if (!reliable) {
    return { current: total, data: [], reliable: false, coverage };
  }

  const firstYear = Math.min(...starts);
  const data: VerloopPoint[] = [];
  for (let year = firstYear; year <= currentYear; year++) {
    const leden = year === currentYear ? total : starts.filter((s) => s <= year).length;
    data.push({ year, leden });
  }
  return { current: total, data, reliable: true, coverage };
};
