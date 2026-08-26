/** Gedeelde matchlogica voor het aanwijzen van de locatie bij een verrijkingsvoorstel. */

export type MemberLocation = Record<string, any>;

const normPostcode = (v: unknown) => String(v ?? "").toUpperCase().replace(/\s+/g, "");
const normName = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Zoekt de locatie van een lid die bij een `location_key` hoort (postcode of genormaliseerde naam). */
export function findMemberLocation(
  locaties: MemberLocation[] | undefined | null,
  locationKey: string | null | undefined,
): MemberLocation | null {
  const list = Array.isArray(locaties) ? locaties : [];
  const key = normPostcode(locationKey);
  if (!key) return null;
  return (
    list.find((l) => normPostcode(l?.postcode) === key) ??
    list.find((l) => normName(l?.naam) === String(locationKey ?? "")) ??
    null
  );
}

/** Korte omschrijving van een locatie voor in de UI. */
export function describeLocation(loc: MemberLocation | null | undefined): string {
  if (!loc) return "";
  const parts = [loc.adres, loc.postcode, loc.plaats].filter(Boolean);
  return parts.join(", ");
}
