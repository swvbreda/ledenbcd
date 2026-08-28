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

/** Samengestelde sleutel `naam|adres|postcode` zoals gebruikt in koppelingen. */
const compact = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function locationKeyOf(loc: MemberLocation | null | undefined): string {
  return [compact(loc?.naam), compact(loc?.adres), compact(loc?.postcode)].join("|");
}

/** Zoekt de locatie van een lid die bij een `location_key` hoort (samengesteld, postcode of naam). */
export function findMemberLocation(
  locaties: MemberLocation[] | undefined | null,
  locationKey: string | null | undefined,
  shop?: RegisterLocationReference | null,
  alternateKeys: Array<string | null | undefined> = [],
): MemberLocation | null {
  const list = Array.isArray(locaties) ? locaties : [];
  const rawKey = String(locationKey ?? "").trim();
  const composite = rawKey.includes("|")
    ? list.find((l) => locationKeyOf(l) === rawKey.toLowerCase()) ??
      list.find((l) => {
        const [n, a, p] = rawKey.toLowerCase().split("|");
        return (
          (!!p && compact(l?.postcode) === p && (!a || compact(l?.adres) === a)) ||
          (!!a && compact(l?.adres) === a) ||
          (!!n && compact(l?.naam) === n)
        );
      })
    : null;
  const key = normPostcode(locationKey);
  const direct =
    composite ??
    (key
      ? list.find((l) => normPostcode(l?.postcode) === key) ??
        list.find((l) => normName(l?.naam) === normName(locationKey))
      : null);
  const alternate = alternateKeys
    .map(normPostcode)
    .filter(Boolean)
    .map((alternateKey) => list.find((l) => normPostcode(l?.postcode) === alternateKey))
    .find(Boolean);
  if (direct || alternate || !shop) return direct ?? alternate ?? null;


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
