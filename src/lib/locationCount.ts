import type { Member } from "@/data/types";

type LocLike = { naam?: string; adres?: string; plaats?: string };

/** Een locatierij telt alleen mee als er een adres of plaats bij staat. */
export const isRealLocation = (loc: LocLike | null | undefined): boolean =>
  !!(loc && (loc.adres?.trim() || loc.plaats?.trim()));

/** Aantal echte locaties van één lid (minimaal 1). */
export const memberLocationCount = (m: Pick<Member, "locaties" | "aantalLocaties">): number => {
  const real = (m.locaties ?? []).filter(isRealLocation).length;
  if (real > 0) return real;
  const fallback = Number(m.aantalLocaties);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
};

/** Totaal aantal vertegenwoordigde coffeeshops over een lijst leden/leads. */
export const countLocations = (members: Pick<Member, "locaties" | "aantalLocaties">[]): number =>
  members.reduce((sum, m) => sum + memberLocationCount(m), 0);
