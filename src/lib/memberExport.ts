import type { Contact, Location, Member } from "@/data/types";
import { getMembershipYears } from "@/lib/membership";
import { getLocationGemeente } from "@/data/gemeenteMapping";

/** Rij op het blad "Leden". */
export interface LedenRow {
  nr: number;
  lidnr: number | string;
  naam: string;
  plaats: string;
  stadsdeel: string;
  jarenLid: number | "";
  lidSinds: number | "";
  oprichtingsjaar: number | "";
  contactpersoon: string;
  functie: string;
  telefoon: string;
  email: string;
  aantalLocaties: number;
  locaties: string;
  kvk: string;
  bedrijfsnaam: string;
  factuurBedrijfsnaam: string;
  factuurAdres: string;
  factuurPostcode: string;
  factuurPlaats: string;
  factuurEmail: string;
  factuurTelefoon: string;
}

/** Rij op het blad "Locaties". */
export interface LocatieRow {
  nr: number;
  lidnr: number | string;
  lidnaam: string;
  locatienaam: string;
  straat: string;
  huisnummer: string;
  toevoeging: string;
  postcode: string;
  plaats: string;
  gemeente: string;
  stadsdeel: string;
  kvk: string;
  bedrijfsnaam: string;
  telefoon: string;
  email: string;
}

/** Rij op het blad "Contactpersonen". */
export interface ContactRow {
  nr: number;
  lidnr: number | string;
  lidnaam: string;
  naam: string;
  functie: string;
  telefoon: string;
  email: string;
  primair: "Ja" | "Nee";
}

const text = (value: unknown): string => String(value ?? "").trim();

/**
 * Leden numeriek oplopend op lidnummer; niet-numerieke of lege nummers achteraan
 * (op naam), zodat de lijst altijd bij het laagste echte lidnummer begint.
 */
export function sortMembersByNumber<T extends { id: unknown; naam?: string }>(
  members: T[],
): T[] {
  const numeric = (m: T): number | null => {
    const raw =
      typeof m.id === "number" ? m.id : Number(String(m.id ?? "").trim());
    return Number.isFinite(raw) && String(m.id ?? "").trim() !== ""
      ? Number(raw)
      : null;
  };
  return [...members].sort((a, b) => {
    const na = numeric(a);
    const nb = numeric(b);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return text(a.naam).localeCompare(text(b.naam), "nl");
  });
}

/** Splitst een Nederlands adres in straat, huisnummer en toevoeging. */
export function splitAddress(adres: unknown): {
  straat: string;
  huisnummer: string;
  toevoeging: string;
} {
  const value = text(adres);
  if (!value) return { straat: "", huisnummer: "", toevoeging: "" };
  const match = value.match(/^(.*?[^\d\s])\s+(\d+)\s*[-/]?\s*(.*)$/);
  if (!match) return { straat: value, huisnummer: "", toevoeging: "" };
  return {
    straat: match[1].trim(),
    huisnummer: match[2],
    toevoeging: match[3].trim(),
  };
}

/** Eén regel per locatie: naam plus volledig adres. */
export function formatLocationLine(loc: Location): string {
  const adresDeel = [
    text(loc.adres),
    [text(loc.postcode), text(loc.plaats)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const naam = text(loc.naam);
  if (naam && adresDeel) return `${naam} — ${adresDeel}`;
  return naam || adresDeel;
}

/** Echte vestigingen: minimaal een adres of plaats. */
const realLocations = (member: Member): Location[] =>
  (member.locaties ?? []).filter((l) => text(l.adres) || text(l.plaats));

/**
 * Effectieve contactpersonen: de hoofdvelden van het lid gelden als primaire
 * contactpersoon, tenzij dezelfde persoon al in `contacten` staat.
 */
export function effectiveContacts(
  member: Member,
): (Contact & { primair: boolean })[] {
  const rows: (Contact & { primair: boolean })[] = [];
  const seen = new Set<string>();
  const key = (naam: string, email: string) =>
    `${naam.toLowerCase()}|${email.toLowerCase()}`;

  const primaryName = text(member.contactpersoon);
  const primaryEmail = text(member.email);
  if (primaryName || primaryEmail) {
    rows.push({
      naam: primaryName,
      functie: text(member.functie),
      telefoon: text(member.telefoon),
      email: primaryEmail,
      primair: true,
    });
    seen.add(key(primaryName, primaryEmail));
  }

  for (const c of member.contacten ?? []) {
    const naam = text(c.naam);
    const email = text(c.email);
    if (!naam && !email) continue;
    const k = key(naam, email);
    if (seen.has(k)) continue;
    // Zelfde persoon als de primaire contactpersoon (naam óf e-mail gelijk) niet dubbel opnemen.
    if (
      rows.length > 0 &&
      rows[0].primair &&
      ((naam && naam.toLowerCase() === rows[0].naam.toLowerCase()) ||
        (email && email.toLowerCase() === rows[0].email.toLowerCase()))
    ) {
      continue;
    }
    seen.add(k);
    rows.push({
      ...c,
      naam,
      email,
      functie: text(c.functie),
      telefoon: text(c.telefoon),
      primair: false,
    });
  }

  return rows;
}

export function buildLedenRows(members: Member[]): LedenRow[] {
  return sortMembersByNumber(members).map((m, index) => {
    const locaties = realLocations(m);
    return {
      nr: index + 1,
      lidnr: m.id,
      naam: text(m.naam),
      plaats: text(m.plaats),
      stadsdeel: text(m.stadsdeel),
      jarenLid: getMembershipYears(m) ?? "",
      lidSinds: typeof m.lidSinds === "number" ? m.lidSinds : "",
      oprichtingsjaar:
        typeof m.oprichtingJaar === "number" ? m.oprichtingJaar : "",
      contactpersoon: text(m.contactpersoon),
      functie: text(m.functie),
      telefoon: text(m.telefoon),
      email: text(m.email),
      aantalLocaties: locaties.length,
      locaties: locaties.map(formatLocationLine).filter(Boolean).join("\n"),
      kvk: text(m.kvk),
      bedrijfsnaam: text(m.bedrijfsnaam),
      factuurBedrijfsnaam: text(m.factuurBedrijfsnaam),
      factuurAdres: text(m.factuurAdres),
      factuurPostcode: text(m.factuurPostcode),
      factuurPlaats: text(m.factuurPlaats),
      factuurEmail: text(m.factuurEmail),
      factuurTelefoon: text(m.factuurTelefoon),
    };
  });
}

export function buildLocatieRows(members: Member[]): LocatieRow[] {
  const rows: Omit<LocatieRow, "nr">[] = [];
  for (const m of sortMembersByNumber(members)) {
    const locaties = [...realLocations(m)].sort((a, b) =>
      text(a.naam).localeCompare(text(b.naam), "nl"),
    );
    for (const loc of locaties) {
      const { straat, huisnummer, toevoeging } = splitAddress(loc.adres);
      rows.push({
        lidnr: m.id,
        lidnaam: text(m.naam),
        locatienaam: text(loc.naam),
        straat,
        huisnummer,
        toevoeging,
        postcode: text(loc.postcode),
        plaats: text(loc.plaats) || text(m.plaats),
        gemeente:
          text(loc.gemeente) || text(getLocationGemeente(loc, m.plaats)),
        stadsdeel: text(loc.stadsdeel) || text(m.stadsdeel),
        kvk: text(loc.kvk),
        bedrijfsnaam: text(loc.vergunninghouder) || text(loc.exploitant),
        telefoon: text(loc.telefoon),
        email: "",
      });
    }
  }
  return rows.map((r, i) => ({ nr: i + 1, ...r }));
}

export function buildContactRows(members: Member[]): ContactRow[] {
  const rows: Omit<ContactRow, "nr">[] = [];
  for (const m of sortMembersByNumber(members)) {
    for (const c of effectiveContacts(m)) {
      rows.push({
        lidnr: m.id,
        lidnaam: text(m.naam),
        naam: c.naam,
        functie: c.functie,
        telefoon: c.telefoon,
        email: c.email,
        primair: c.primair ? "Ja" : "Nee",
      });
    }
  }
  return rows.map((r, i) => ({ nr: i + 1, ...r }));
}

export interface WorkbookData {
  leden: LedenRow[];
  locaties: LocatieRow[];
  contacten: ContactRow[];
}

export function buildWorkbookData(members: Member[]): WorkbookData {
  return {
    leden: buildLedenRows(members),
    locaties: buildLocatieRows(members),
    contacten: buildContactRows(members),
  };
}

export const exportFileName = (date = new Date()): string =>
  `bcd-leden-${date.toISOString().slice(0, 10)}.xlsx`;
