import type { Contact, Member } from "@/data/types";

export type AccountContactMatch =
  | { kind: "primary"; name: string }
  | { kind: "secondary"; name: string }
  | { kind: "contact"; name: string; index: number };

/** Splitst ook oudere velden waarin meerdere e-mailadressen samen zijn opgeslagen. */
export function normalizeEmailList(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(/[,;/\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function emailFieldContains(value: string | null | undefined, email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail !== "" && normalizeEmailList(value).includes(normalizedEmail);
}

export function findAccountContact(member: Member, accountEmail: string): AccountContactMatch | null {
  if (emailFieldContains(member.email, accountEmail) && member.contactpersoon?.trim()) {
    return { kind: "primary", name: member.contactpersoon.trim() };
  }

  if (emailFieldContains(member.email2, accountEmail) && member.contactpersoon2?.trim()) {
    return { kind: "secondary", name: member.contactpersoon2.trim() };
  }

  const index = (member.contacten ?? []).findIndex((contact) =>
    emailFieldContains(contact.email, accountEmail),
  );
  if (index >= 0) {
    const contact = member.contacten[index];
    if (contact?.naam?.trim()) return { kind: "contact", name: contact.naam.trim(), index };
  }

  return null;
}

export function renameMatchedContact(
  member: Member,
  match: AccountContactMatch,
  name: string,
): Pick<Member, "contactpersoon"> | Pick<Member, "contactpersoon2"> | Pick<Member, "contacten"> {
  if (match.kind === "primary") return { contactpersoon: name };
  if (match.kind === "secondary") return { contactpersoon2: name };

  const contacten: Contact[] = (member.contacten ?? []).map((contact, index) =>
    index === match.index ? { ...contact, naam: name } : contact,
  );
  return { contacten };
}