import type { Location } from "@/data/types";

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const normalizePostcode = (value: unknown) => normalize(value).toUpperCase();

const parseAddress = (value: unknown) => {
  const raw = String(value ?? "").toLowerCase();
  const houseNumberWithSuffix = raw.match(/\b\d+\s*[a-z]{0,3}\b/)?.[0] ?? "";
  const houseNumber = houseNumberWithSuffix.match(/\d+/)?.[0] ?? "";
  return {
    houseNumber: normalize(houseNumber),
    suffix: normalize(houseNumberWithSuffix.replace(houseNumber, "")),
    street: normalize(raw.replace(houseNumberWithSuffix, "")),
  };
};

const comparableName = (value: unknown) => normalize(value).replace(/^coffeeshop/, "");

const approximatelySameName = (left: unknown, right: unknown): boolean => {
  const a = comparableName(left);
  const b = comparableName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 7) return false;
  return editDistance(a, b) / Math.max(a.length, b.length) <= 0.25;
};

const editDistance = (left: string, right: string): number => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
};

const approximatelySameAddress = (left: Partial<Location>, right: Partial<Location>): boolean => {
  const leftPlace = normalize(left.plaats);
  const rightPlace = normalize(right.plaats);
  if (!leftPlace || !rightPlace || leftPlace !== rightPlace) return false;

  const leftAddress = parseAddress(left.adres);
  const rightAddress = parseAddress(right.adres);
  if (
    !leftAddress.houseNumber ||
    leftAddress.houseNumber !== rightAddress.houseNumber ||
    leftAddress.street.length < 8 ||
    rightAddress.street.length < 8
  ) return false;

  const longestLength = Math.max(leftAddress.street.length, rightAddress.street.length);
  const sameStreet = editDistance(leftAddress.street, rightAddress.street) / longestLength <= 0.22;
  if (!sameStreet) return false;

  // Een ontbrekende/toegevoegde huisnummertoevoeging (5 ↔ 5hs, 8 ↔ 8h)
  // komt in de brondata regelmatig voor. Alleen samenvoegen als ook postcode
  // en vestigingsnaam overeenkomen, zodat echte units A/B apart blijven.
  if (leftAddress.suffix !== rightAddress.suffix) {
    return normalizePostcode(left.postcode) === normalizePostcode(right.postcode)
      && approximatelySameName(left.naam, right.naam);
  }
  return true;
};

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

  if (approximatelySameAddress(left, right)) return true;

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

/** Voegt vestigingen met hetzelfde adres samen tot één kaart, met de rijkste gegevens. */
export function dedupeLocations(locations: Location[]): Location[] {
  const result: Location[] = [];

  for (const location of locations) {
    const existingIndex = result.findIndex((existing) => {
      if (physicalLocationsMatch(existing, location)) return true;

      const existingHasPhysicalIdentity = !!(normalizePostcode(existing.postcode) || normalize(existing.adres));
      const locationHasPhysicalIdentity = !!(normalizePostcode(location.postcode) || normalize(location.adres));
      if (existingHasPhysicalIdentity && locationHasPhysicalIdentity) return false;

      const samePlace = normalize(existing.plaats) === normalize(location.plaats);
      return samePlace && approximatelySameName(existing.naam, location.naam);
    });
    if (existingIndex < 0) {
      result.push(location);
      continue;
    }

    const existing = result[existingIndex];
    const merged: Location = { ...existing };
    for (const [field, value] of Object.entries(location)) {
      const isEmpty = typeof value === "string" ? value.trim() === "" : value === null || value === undefined;
      const currentValue = (merged as unknown as Record<string, unknown>)[field];
      const currentIsEmpty = typeof currentValue === "string"
        ? currentValue.trim() === ""
        : currentValue === null || currentValue === undefined;
      if (!isEmpty && currentIsEmpty) (merged as unknown as Record<string, unknown>)[field] = value;
    }
    result[existingIndex] = merged;
  }

  return result;
}

/**
 * Markeert het oude adres als vervangen wanneer een bevestigde registerkoppeling
 * verhuist. De nieuwe locatie blijft in de overlay staan; de oude basislocatie
 * kan daardoor niet opnieuw als extra vestiging terugkomen.
 */
export function replacementDeletionIdentities(
  current: string[] | null | undefined,
  previous: Partial<Location> | null | undefined,
  replacement: Partial<Location> | null | undefined,
): string[] {
  const result = new Set(Array.isArray(current) ? current : []);
  if (!previous || !replacement) return Array.from(result);
  const previousIdentity = locationDeletionIdentity(previous);
  if (previousIdentity !== locationDeletionIdentity(replacement)) result.add(previousIdentity);
  return Array.from(result);
}
