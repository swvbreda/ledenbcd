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

  return result;
}
