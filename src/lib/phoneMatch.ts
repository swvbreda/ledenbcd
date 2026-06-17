import type { Member } from "@/data/types";

/**
 * Normalize a phone number to a canonical comparable form.
 * Strategy: strip non-digits, then compare on the last 9 digits.
 * This handles +31 / 0031 / 06 variations and stray spaces/dashes/parens.
 * Returns null when there are not enough digits to be a phone number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, "");
  if (digits.length < 8) return null;
  // Last 9 digits = the unique part of a NL mobile/landline without country code.
  return digits.slice(-9);
}

/**
 * Extract all phone-number-like substrings from a free-form text blob.
 * Accepts +, digits, spaces, dashes, parens. Returns the *raw* matches;
 * call normalizePhone() on each to compare.
 */
export function extractPhones(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /(\+?\d[\d\s\-().]{6,}\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

/**
 * Format a Dutch phone number with spaces for readability.
 * Examples:
 *   0682101033        -> 06 82 10 10 33
 *   +31682101033      -> +31 6 82 10 10 33
 *   0205551234        -> 020 555 1234
 * Falls back to the raw input when the shape is unrecognized.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length < 8) return trimmed;

  // International +31 ...
  if (hasPlus && digits.startsWith("31")) {
    const rest = digits.slice(2);
    // Mobile: 6xxxxxxxx
    if (rest.startsWith("6") && rest.length === 9) {
      return `+31 6 ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
    }
    // Landline: area + subscriber (best effort)
    if (rest.length === 9) {
      return `+31 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 9)}`;
    }
    return `+31 ${rest}`;
  }

  // NL mobile: 06xxxxxxxx (10 digits)
  if (digits.startsWith("06") && digits.length === 10) {
    return `06 ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }

  // NL landline 10 digits starting with 0
  if (digits.startsWith("0") && digits.length === 10) {
    // 3-digit area (e.g. 020, 030, 070) or 4-digit area
    const threeDigitAreas = new Set([
      "010","013","015","020","023","024","026","030","033","035","036","038",
      "040","043","045","046","050","053","055","058","070","071","072","073",
      "074","075","076","077","078","079",
    ]);
    const area3 = digits.slice(0, 3);
    if (threeDigitAreas.has(area3)) {
      return `${area3} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
    }
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }

  return trimmed;
}

export interface MemberPhoneEntry {
  memberId: number;
  memberName: string;
  memberPlaats: string;
  rawNumber: string;
  normalized: string;
  contactNaam: string;
  contactRol: string; // "Hoofdcontact" or e.g. "Eigenaar"
}

/**
 * Build a flat list of all known phone numbers across members, plus an index
 * keyed by normalized number for fast lookup. Each member can appear multiple
 * times (one entry per known phone number).
 */
export function buildPhoneIndex(members: Member[]): {
  entries: MemberPhoneEntry[];
  byNormalized: Map<string, MemberPhoneEntry[]>;
} {
  const entries: MemberPhoneEntry[] = [];
  const byNormalized = new Map<string, MemberPhoneEntry[]>();

  const push = (entry: MemberPhoneEntry) => {
    entries.push(entry);
    const list = byNormalized.get(entry.normalized);
    if (list) list.push(entry);
    else byNormalized.set(entry.normalized, [entry]);
  };

  for (const m of members) {
    const memberName = m.naam || m.bedrijfsnaam || `Lid #${m.id}`;
    const memberPlaats = m.plaats || "";

    if (m.telefoon) {
      const n = normalizePhone(m.telefoon);
      if (n) {
        push({
          memberId: m.id,
          memberName,
          memberPlaats,
          rawNumber: m.telefoon,
          normalized: n,
          contactNaam: m.contactpersoon || "—",
          contactRol: "Hoofdcontact",
        });
      }
    }

    for (const c of m.contacten ?? []) {
      if (!c?.telefoon) continue;
      const n = normalizePhone(c.telefoon);
      if (!n) continue;
      push({
        memberId: m.id,
        memberName,
        memberPlaats,
        rawNumber: c.telefoon,
        normalized: n,
        contactNaam: c.naam || "—",
        contactRol: c.functie || "Contactpersoon",
      });
    }
  }

  return { entries, byNormalized };
}