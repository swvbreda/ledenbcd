import type { Member } from "@/data/types";

type LocLike = { naam?: string; adres?: string; plaats?: string; postcode?: string };

/** Een locatierij telt alleen mee als er een adres of plaats bij staat. */
export const isRealLocation = (loc: LocLike | null | undefined): boolean =>
  !!(loc && (loc.adres?.trim() || loc.plaats?.trim()));

/** Genormaliseerde adressleutel (adres + postcode) om dubbele vestigingen te herkennen. */
export const locationAddressKey = (loc: LocLike | null | undefined): string =>
  `${loc?.adres ?? ""}${loc?.postcode ?? ""}`.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Echte locaties van één lid, ontdubbeld op adres + postcode. */
const uniqueLocations = (m: Pick<Member, "locaties" | "aantalLocaties">): LocLike[] => {
  const seen = new Set<string>();
  const result: LocLike[] = [];
  for (const loc of (m.locaties ?? []) as LocLike[]) {
    if (!isRealLocation(loc)) continue;
    const key = locationAddressKey(loc);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(loc);
  }
  return result;
};

/** Aantal echte locaties van één lid (minimaal 1), zonder dubbele adressen. */
export const memberLocationCount = (m: Pick<Member, "locaties" | "aantalLocaties">): number => {
  const real = uniqueLocations(m).length;
  if (real > 0) return real;
  const fallback = Number(m.aantalLocaties);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
};

/**
 * Totaal aantal vertegenwoordigde coffeeshops over een lijst leden/leads.
 * Hetzelfde adres telt maar één keer, ook als het bij meerdere leden staat.
 */
export const countLocations = (members: Pick<Member, "locaties" | "aantalLocaties">[]): number => {
  const seen = new Set<string>();
  let total = 0;
  for (const m of members) {
    const locs = uniqueLocations(m);
    if (locs.length === 0) {
      total += memberLocationCount(m);
      continue;
    }
    for (const loc of locs) {
      const key = locationAddressKey(loc);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      total += 1;
    }
  }
  return total;
};
