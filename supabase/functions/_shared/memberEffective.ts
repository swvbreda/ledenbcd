/**
 * Effectieve ledengegevens = basis (members_data) + goedgekeurde wijzigingen
 * (member_edits), inclusief locatie-merge en verwijderde locaties.
 *
 * Deze logica is bewust identiek aan `src/lib/memberLocations.ts` in de
 * frontend: het register mag nooit een ander beeld van het lid hanteren dan
 * wat het lid zelf ziet. De edge function (Deno) kan `src/` niet importeren,
 * daarom staat de gedeelde implementatie hier en wordt zij met dezelfde tests
 * bewaakt.
 */

export type LocationLike = Record<string, unknown> & {
  naam?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
};

export type MemberDataLike = Record<string, unknown> & {
  locaties?: LocationLike[];
  _verwijderdeLocaties?: string[];
};

export const normText = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

/**
 * Vergelijkingsnormalisatie: negeert daarnaast accenten, zodat alleen
 * spaties, hoofdletters, leestekens of schrijfwijze geen verschil opleveren.
 */
export const normCompare = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

export const normPostcode = (value: unknown): string =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

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

const parseAddress = (value: unknown) => {
  const raw = String(value ?? "").toLowerCase();
  const withSuffix = raw.match(/\b\d+\s*[a-z]{0,3}\b/)?.[0] ?? "";
  const number = withSuffix.match(/\d+/)?.[0] ?? "";
  return {
    number: normText(number),
    suffix: normText(withSuffix.replace(number, "")),
    street: normText(raw.replace(withSuffix, "")),
  };
};

const comparableName = (value: unknown) => normText(value).replace(/^coffeeshop/, "");
const approximatelySameName = (left: unknown, right: unknown): boolean => {
  const a = comparableName(left);
  const b = comparableName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 7
    && editDistance(a, b) / Math.max(a.length, b.length) <= 0.25;
};

const approximatelySameAddress = (left: LocationLike, right: LocationLike): boolean => {
  const leftPlace = normText(left.plaats);
  const rightPlace = normText(right.plaats);
  if (!leftPlace || !rightPlace || leftPlace !== rightPlace) return false;
  const a = parseAddress(left.adres);
  const b = parseAddress(right.adres);
  if (!a.number || a.number !== b.number || a.street.length < 8 || b.street.length < 8) return false;
  if (editDistance(a.street, b.street) / Math.max(a.street.length, b.street.length) > 0.22) return false;
  if (a.suffix !== b.suffix) {
    return normPostcode(left.postcode) === normPostcode(right.postcode)
      && approximatelySameName(left.naam, right.naam);
  }
  return true;
};

/** Vergelijkt twee waarden van hetzelfde veld genormaliseerd. */
export function sameFieldValue(field: string, a: unknown, b: unknown): boolean {
  if (field === "postcode") return normPostcode(a) === normPostcode(b);
  return normCompare(a) === normCompare(b);
}

export const locationIdentity = (location: LocationLike): string => {
  const postcode = normPostcode(location?.postcode);
  if (postcode) return `postcode:${postcode}`;
  const address = normText(location?.adres);
  if (address) return `adres:${address}`;
  return `naam:${normText(location?.naam)}|plaats:${normText(location?.plaats)}`;
};

export const locationDeletionIdentity = (location: LocationLike): string => {
  const postcode = normPostcode(location?.postcode);
  const address = normText(location?.adres);
  if (postcode && address) return `locatie:${postcode}|${address}`;
  if (address) return `locatie:adres:${address}`;
  return locationIdentity(location);
};

export function isLocationDeleted(
  location: LocationLike,
  deletedIdentities: string[] = [],
): boolean {
  const deleted = new Set(deletedIdentities);
  return (
    deleted.has(locationDeletionIdentity(location)) || deleted.has(locationIdentity(location))
  );
}

const physicalLocationsMatch = (left: LocationLike, right: LocationLike): boolean => {
  const leftPostcode = normPostcode(left?.postcode);
  const rightPostcode = normPostcode(right?.postcode);
  const leftAddress = normText(left?.adres);
  const rightAddress = normText(right?.adres);
  const leftPlace = normText(left?.plaats);
  const rightPlace = normText(right?.plaats);
  const compatiblePlace = !leftPlace || !rightPlace || leftPlace === rightPlace;
  if (leftPostcode && rightPostcode && leftPostcode === rightPostcode && (!leftAddress || !rightAddress || leftAddress === rightAddress)) return true;
  if (leftAddress && rightAddress && leftAddress === rightAddress && compatiblePlace) return true;
  return approximatelySameAddress(left, right);
};

/** Zelfde gekoppelde vestiging? Fysiek adres, of dezelfde naam binnen dezelfde plaats. */
export function locationsMatch(left: LocationLike, right: LocationLike): boolean {
  if (physicalLocationsMatch(left, right)) return true;

  const leftName = normText(left?.naam);
  const rightName = normText(right?.naam);
  const leftPlace = normText(left?.plaats);
  const rightPlace = normText(right?.plaats);
  return (
    !!leftName && leftName === rightName && (!leftPlace || !rightPlace || leftPlace === rightPlace)
  );
}

/** Voegt vestigingen met hetzelfde adres samen; de rijkste gegevens winnen. */
export function dedupeLocations(locations: LocationLike[]): LocationLike[] {
  const result: LocationLike[] = [];

  for (const location of locations) {
    const existingIndex = result.findIndex((existing) => {
      if (physicalLocationsMatch(existing, location)) return true;
      const existingHasIdentity = !!(normPostcode(existing.postcode) || normText(existing.adres));
      const locationHasIdentity = !!(normPostcode(location.postcode) || normText(location.adres));
      return !(existingHasIdentity && locationHasIdentity)
        && normText(existing.plaats) === normText(location.plaats)
        && approximatelySameName(existing.naam, location.naam);
    });
    if (existingIndex < 0) {
      result.push(location);
      continue;
    }
    const existing = result[existingIndex];
    const merged: LocationLike = { ...existing };
    for (const [field, value] of Object.entries(location)) {
      const isEmpty =
        typeof value === "string" ? value.trim() === "" : value === null || value === undefined;
      const current = merged[field];
      const currentIsEmpty = typeof current === "string"
        ? current.trim() === ""
        : current === null || current === undefined;
      if (!isEmpty && currentIsEmpty) merged[field] = value;
    }
    result[existingIndex] = merged;
  }

  return result;
}

/** Combineert basislocaties met correcties uit member_edits. */
export function mergeMemberLocations(
  base: LocationLike[] | null | undefined,
  overlay: LocationLike[] | null | undefined,
  deletedIdentities: string[] = [],
): LocationLike[] {
  const overlayLocations = Array.isArray(overlay) ? overlay : [];
  const usedOverlay = new Set<number>();
  const result: LocationLike[] = [];

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
    if (!usedOverlay.has(index) && !isLocationDeleted(location, deletedIdentities)) {
      result.push(location);
    }
  });

  return dedupeLocations(result);
}

export type EffectiveMember = {
  /** Lidgegevens zoals het lid ze ziet: basis + goedgekeurde wijzigingen. */
  data: MemberDataLike;
  /** Effectieve vestigingen (samengevoegd). */
  locaties: LocationLike[];
  /** Door het lid verwijderde vestigingen; nooit opnieuw toevoegen. */
  verwijderd: string[];
};

/** Bouwt de effectieve ledengegevens uit basis en goedgekeurde wijzigingen. */
export function effectiveMember(
  base: MemberDataLike | null | undefined,
  overlay: MemberDataLike | null | undefined,
): EffectiveMember {
  const baseData = (base ?? {}) as MemberDataLike;
  const overlayData = (overlay ?? {}) as MemberDataLike;
  const verwijderd = Array.isArray(overlayData._verwijderdeLocaties)
    ? overlayData._verwijderdeLocaties
    : [];
  const locaties = mergeMemberLocations(baseData.locaties, overlayData.locaties, verwijderd);
  const data: MemberDataLike = { ...baseData, ...overlayData, locaties };
  return { data, locaties, verwijderd };
}

export type LayerTarget = { layer: "overlay" | "base"; index: number } | null;

/**
 * Bepaalt in welke laag een effectieve vestiging moet worden bijgewerkt:
 * staat zij in de wijzigingslaag, dan daar; anders in de basis.
 */
export function locationTarget(
  base: MemberDataLike | null | undefined,
  overlay: MemberDataLike | null | undefined,
  location: LocationLike,
): LayerTarget {
  const overlayLocations = Array.isArray(overlay?.locaties) ? overlay!.locaties! : [];
  const overlayIndex = overlayLocations.findIndex((candidate) =>
    locationsMatch(candidate, location),
  );
  if (overlayIndex >= 0) return { layer: "overlay", index: overlayIndex };

  const baseLocations = Array.isArray(base?.locaties) ? base!.locaties! : [];
  const baseIndex = baseLocations.findIndex((candidate) => locationsMatch(candidate, location));
  if (baseIndex >= 0) return { layer: "base", index: baseIndex };

  return null;
}

/** Een echte vestiging heeft minimaal adres of plaats. */
export function realLocationCount(locaties: LocationLike[]): number {
  return locaties.filter(
    (loc) => String(loc?.adres ?? "").trim() || String(loc?.plaats ?? "").trim(),
  ).length;
}

/** Samengestelde koppelsleutel `naam|adres|postcode` van een ledenlocatie. */
export function locationKeyOf(location: LocationLike): string {
  return [normText(location?.naam), normText(location?.adres), normText(location?.postcode)].join(
    "|",
  );
}

/** Zoekt de ledenlocatie waar een bevestigde koppeling naar verwijst. */
export function findByLinkKey(
  locaties: LocationLike[],
  linkKey: string | null | undefined,
): LocationLike | null {
  const key = String(linkKey ?? "").trim().toLowerCase();
  if (!key) return null;
  if (key.includes("|")) {
    const [n, a, p] = key.split("|");
    return (
      locaties.find((l) => locationKeyOf(l) === key) ??
      locaties.find((l) => !!a && normText(l?.adres) === a) ??
      locaties.find((l) => !!p && normText(l?.postcode) === p) ??
      locaties.find((l) => !!n && normText(l?.naam) === n) ??
      null
    );
  }
  return (
    locaties.find((l) => normPostcode(l?.postcode) === normPostcode(key)) ??
    locaties.find((l) => normText(l?.naam) === normText(key)) ??
    null
  );
}
