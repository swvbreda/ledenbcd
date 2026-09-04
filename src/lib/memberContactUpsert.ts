import type { Contact, Member } from "@/data/types";
import { normalizePhone } from "@/lib/phoneMatch";

export type SaveContactMode = "contact" | "primary" | "none";

export interface ContactInput {
  naam: string;
  telefoon: string;
  functie?: string;
  email?: string;
}

/** Alle telefoonnummers die al bij een lid bekend zijn (genormaliseerd). */
export function knownMemberPhones(member: Member): Set<string> {
  const out = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const n = normalizePhone(raw);
    if (n) out.add(n);
  };
  add(member.telefoon);
  add(member.telefoon2);
  add(member.factuurTelefoon);
  (member.contacten ?? []).forEach((c) => add(c.telefoon));
  (member.locaties ?? []).forEach((l) => add(l.telefoon));
  return out;
}

/** Staat dit nummer (en eventueel deze naam) al bij het lid? */
export function isPhoneKnown(member: Member, phone: string): boolean {
  const n = normalizePhone(phone);
  return !!n && knownMemberPhones(member).has(n);
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Bouwt de wijziging voor het lid. Retourneert null als er niets op te slaan valt.
 * Overschrijft nooit bestaande gegevens buiten de gekozen modus.
 */
export function buildMemberContactPatch(
  member: Member,
  input: ContactInput,
  mode: SaveContactMode,
): Partial<Member> | null {
  const naam = input.naam.trim();
  const telefoon = input.telefoon.trim();
  if (mode === "none" || !naam) return null;

  if (mode === "primary") {
    const patch: Partial<Member> = {};
    if (telefoon && normalizePhone(telefoon) !== normalizePhone(member.telefoon)) {
      patch.telefoon = telefoon;
    }
    if (!member.contactpersoon?.trim()) patch.contactpersoon = naam;
    if (input.email?.trim() && !member.email?.trim()) patch.email = input.email.trim();
    return Object.keys(patch).length > 0 ? patch : null;
  }

  const contacten: Contact[] = [...(member.contacten ?? [])];
  const phoneNorm = normalizePhone(telefoon);
  const existingIndex = contacten.findIndex(
    (c) =>
      (phoneNorm && normalizePhone(c.telefoon) === phoneNorm) ||
      (!!c.naam && sameName(c.naam, naam)),
  );

  const next: Contact = {
    naam,
    functie: input.functie?.trim() || "Community",
    telefoon,
    email: input.email?.trim() || "",
  };

  if (existingIndex >= 0) {
    const current = contacten[existingIndex];
    const merged: Contact = {
      ...current,
      naam: current.naam?.trim() || next.naam,
      functie: current.functie?.trim() || next.functie,
      telefoon: current.telefoon?.trim() || next.telefoon,
      email: current.email?.trim() || next.email,
    };
    const unchanged =
      merged.naam === current.naam &&
      merged.functie === current.functie &&
      merged.telefoon === current.telefoon &&
      merged.email === current.email;
    if (unchanged) return null;
    contacten[existingIndex] = merged;
  } else {
    contacten.push(next);
  }

  return { contacten };
}
