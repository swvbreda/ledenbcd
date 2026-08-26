/** Gedeelde matchlogica voor het aanwijzen van de locatie bij een verrijkingsvoorstel. */

export type MemberLocation = Record<string, any>;

export type RegisterLocationReference = {
  naam?: string | null;
  straat?: string | null;
  huisnummer?: string | null;
  huisnummer_toevoeging?: string | null;
  postcode?: string | null;
  plaats?: string | null;
};

const normPostcode = (v: unknown) => String(v ?? "").toUpperCase().replace(/\s+/g, "");
const normName = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const houseNumber = (v: unknown) => String(v ?? "").match(/\d+/)?.[0] ?? "";

const registerAddress = (shop: RegisterLocationReference) =>
  [shop.straat, [shop.huisnummer, shop.huisnummer_toevoeging].filter(Boolean).join("")]
    .filter(Boolean)
    .join(" ");

/** Zoekt de locatie van een lid die bij een `location_key` hoort (postcode of genormaliseerde naam). */
export function findMemberLocation(
  locaties: MemberLocation[] | undefined | null,
  locationKey: string | null | undefined,
  shop?: RegisterLocationReference | null,
): MemberLocation | null {
  const list = Array.isArray(locaties) ? locaties : [];
  const key = normPostcode(locationKey);
  const direct = key
    ? list.find((l) => normPostcode(l?.postcode) === key) ??
      list.find((l) => normName(l?.naam) === normName(locationKey))
    : null;
  if (direct || !shop) return direct ?? null;

  const shopPostcode = normPostcode(shop.postcode);
  const shopName = normName(shop.naam);
  const shopPlace = normName(shop.plaats);
  const shopAddress = normName(registerAddress(shop));
  const shopNumber = houseNumber(shop.huisnummer);

  return (
    list.find(
      (l) =>
        shopPostcode &&
        normPostcode(l?.postcode) === shopPostcode &&
        (!shopNumber || houseNumber(l?.adres) === shopNumber),
    ) ??
    list.find(
      (l) =>
        shopName &&
        normName(l?.naam) === shopName &&
        (!shopPlace || !l?.plaats || normName(l.plaats) === shopPlace),
    ) ??
    list.find((l) => shopAddress && normName(l?.adres) === shopAddress) ??
    null
  );
}

/** Korte omschrijving van een locatie voor in de UI. */
export function describeLocation(loc: MemberLocation | null | undefined): string {
  if (!loc) return "";
  const parts = [loc.adres, loc.postcode, loc.plaats].filter(Boolean);
  return parts.join(", ");
}
