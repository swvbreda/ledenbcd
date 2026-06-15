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