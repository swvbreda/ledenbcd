import type { Contact, Location } from "@/data/types";
import { locationIdentity } from "@/lib/memberLocations";

/** Label van een vestiging voor weergave in lijstjes. */
export const locationLabel = (loc: Partial<Location>): string =>
  [loc.naam, loc.plaats].filter(Boolean).join(" — ") || loc.adres || "Vestiging";

/**
 * Vestigingen waar een contactpersoon expliciet aan gekoppeld is.
 * Lege lijst = geldt voor alle vestigingen van het lid.
 */
export function contactLocations(contact: Contact, locaties: Location[]): Location[] {
  const keys = new Set(contact.locaties ?? []);
  if (keys.size === 0) return [];
  return locaties.filter((loc) => keys.has(locationIdentity(loc)));
}

/** Contactpersonen die bij een specifieke vestiging horen (incl. lid-brede contacten). */
export function contactsForLocation(
  contacten: Contact[],
  locatie: Location,
  { includeGlobal = false }: { includeGlobal?: boolean } = {},
): Contact[] {
  const id = locationIdentity(locatie);
  return (contacten ?? []).filter((c) => {
    const keys = c.locaties ?? [];
    if (keys.length === 0) return includeGlobal;
    return keys.includes(id);
  });
}
