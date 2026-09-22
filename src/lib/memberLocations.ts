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

/** Adres-specifieke sleutel voor verwijderingen; contactkoppelingen houden hun bestaande sleutel. */
export const locationDeletionIdentity = (location: Partial<Location>): string => {
  const postcode = normalizePostcode(location.postcode);
  const address = normalize(location.adres);
  if (postcode && address) return `locatie:${postcode}|${address}`;
  if (address) return `locatie:adres:${address}`;
  return locationIdentity(location);
};

export const isLocationDeleted = (
  location: Partial<Location>,
  deletedIdentities: string[],
): boolean => {
  const deleted = new Set(deletedIdentities);
  return deleted.has(locationDeletionIdentity(location)) || deleted.has(locationIdentity(location));
};

const physicalLocationsMatch = (left: Partial<Location>, right: Partial<Location>): boolean => {
  const leftPostcode = normalizePostcode(left.postcode);
  const rightPostcode = normalizePostcode(right.postcode);
  const leftAddress = normalize(left.adres);
  const rightAddress = normalize(right.adres);
  const leftPlace = normalize(left.plaats);
  const rightPlace = normalize(right.plaats);
  const compatiblePlace = !leftPlace || !rightPlace || leftPlace === rightPlace;

  if (
    leftPostcode &&
    rightPostcode &&
    leftPostcode === rightPostcode &&
    (!leftAddress || !rightAddress || leftAddress === rightAddress)
  ) return true;

  if (leftAddress && rightAddress && leftAddress === rightAddress && compatiblePlace) return true;

  return false;
};

const locationsMatch = (left: Partial<Location>, right: Partial<Location>): boolean => {
  if (physicalLocationsMatch(left, right)) return true;

  const leftName = normalize(left.naam);
  const rightName = normalize(right.naam);
  const leftPlace = normalize(left.plaats);
  const rightPlace = normalize(right.plaats);
  const compatiblePlace = !leftPlace || !rightPlace || leftPlace === rightPlace;
  return !!leftName && leftName === rightName && compatiblePlace;
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
  const overlayLocations = Array.isArray(overlay) ? overlay : [];
  const usedOverlay = new Set<number>();
  const result: Location[] = [];

  for (const baseLocation of Array.isArray(base) ? base : []) {
    if (isLocationDeleted(baseLocation, deletedIdentities)) continue;

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
    if (!usedOverlay.has(index) && !isLocationDeleted(location, deletedIdentities)) result.push(location);
  });

  return dedupeLocations(result);
}

const filledFields = (location: Partial<Location>) =>
  Object.values(location ?? {}).filter((value) =>
    typeof value === "string" ? value.trim() !== "" : value !== null && value !== undefined,
  ).length;

/** Voegt vestigingen met hetzelfde adres samen tot één kaart, met de rijkste gegevens. */
export function dedupeLocations(locations: Location[]): Location[] {
  const result: Location[] = [];

  for (const location of locations) {
    const existingIndex = result.findIndex((existing) => physicalLocationsMatch(existing, location));
    if (existingIndex < 0) {
      result.push(location);
      continue;
    }

    const existing = result[existingIndex];
    const [primary, secondary] =
      filledFields(location) > filledFields(existing) ? [location, existing] : [existing, location];
    const merged: Location = { ...secondary };
    for (const [field, value] of Object.entries(primary)) {
      const isEmpty = typeof value === "string" ? value.trim() === "" : value === null || value === undefined;
      if (!isEmpty) (merged as unknown as Record<string, unknown>)[field] = value;
    }
    result[existingIndex] = merged;
  }

  return result;
}
