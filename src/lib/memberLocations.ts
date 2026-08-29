import type { Location } from "@/data/types";

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const normalizePostcode = (value: unknown) => normalize(value).toUpperCase();

export const locationIdentity = (location: Partial<Location>): string => {
  const postcode = normalizePostcode(location.postcode);
  if (postcode) return `postcode:${postcode}`;

  const address = normalize(location.adres);
  if (address) return `adres:${address}`;

  return `naam:${normalize(location.naam)}|plaats:${normalize(location.plaats)}`;
};

const locationsMatch = (left: Partial<Location>, right: Partial<Location>): boolean => {
  const leftPostcode = normalizePostcode(left.postcode);
  const rightPostcode = normalizePostcode(right.postcode);
  if (leftPostcode && rightPostcode && leftPostcode === rightPostcode) return true;

  const leftAddress = normalize(left.adres);
  const rightAddress = normalize(right.adres);
  if (leftAddress && rightAddress && leftAddress === rightAddress) return true;

  const leftName = normalize(left.naam);
  const rightName = normalize(right.naam);
  const leftPlace = normalize(left.plaats);
  const rightPlace = normalize(right.plaats);
  return !!leftName && leftName === rightName && (!leftPlace || !rightPlace || leftPlace === rightPlace);
};

/**
 * Combineert actuele basislocaties met correcties uit member_edits.
 * Nieuwe basislocaties blijven behouden; expliciet verwijderde locaties niet.
 */
export function mergeMemberLocations(
  base: Location[] | null | undefined,
  overlay: Location[] | null | undefined,
  deletedIdentities: string[] = [],
): Location[] {
  const deleted = new Set(deletedIdentities);
  const overlayLocations = Array.isArray(overlay) ? overlay : [];
  const usedOverlay = new Set<number>();
  const result: Location[] = [];

  for (const baseLocation of Array.isArray(base) ? base : []) {
    if (deleted.has(locationIdentity(baseLocation))) continue;

    const overlayIndex = overlayLocations.findIndex(
      (candidate, index) => !usedOverlay.has(index) && locationsMatch(baseLocation, candidate),
    );
    if (overlayIndex < 0) {
      result.push(baseLocation);
      continue;
    }

    usedOverlay.add(overlayIndex);
    result.push({ ...baseLocation, ...overlayLocations[overlayIndex] });
  }

  overlayLocations.forEach((location, index) => {
    if (!usedOverlay.has(index) && !deleted.has(locationIdentity(location))) result.push(location);
  });

  return dedupeLocations(result);
}

/** Sleutel waarop twee vestigingen als dezelfde fysieke locatie gelden. */
const dedupeKey = (location: Partial<Location>): string | null => {
  const postcode = normalizePostcode(location.postcode);
  const address = normalize(location.adres);
  if (postcode && address) return `${postcode}|${address}`;
  if (postcode) return `pc:${postcode}`;
  if (address) return `ad:${address}`;
  return null;
};

const filledFields = (location: Partial<Location>) =>
  Object.values(location ?? {}).filter((value) =>
    typeof value === "string" ? value.trim() !== "" : value !== null && value !== undefined,
  ).length;

/** Voegt vestigingen met hetzelfde adres samen tot één kaart, met de rijkste gegevens. */
export function dedupeLocations(locations: Location[]): Location[] {
  const byKey = new Map<string, number>();
  const result: Location[] = [];

  for (const location of locations) {
    const key = dedupeKey(location);
    const existingIndex = key !== null ? byKey.get(key) : undefined;
    if (existingIndex === undefined) {
      if (key !== null) byKey.set(key, result.length);
      result.push(location);
      continue;
    }

    const existing = result[existingIndex];
    const [primary, secondary] =
      filledFields(location) > filledFields(existing) ? [location, existing] : [existing, location];
    const merged: Location = { ...secondary };
    for (const [field, value] of Object.entries(primary)) {
      const isEmpty = typeof value === "string" ? value.trim() === "" : value === null || value === undefined;
      if (!isEmpty) (merged as Record<string, unknown>)[field] = value;
    }
    result[existingIndex] = merged;
  }

  return result;
}

