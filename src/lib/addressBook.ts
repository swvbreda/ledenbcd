import type { Database } from '@/integrations/supabase/types';

export const addressCategories = ['Tweede Kamer', 'Eerste Kamer', 'Ministerie', 'Gemeente', 'Brancheorganisatie', 'Banken', 'Betalingsverkeer', 'Toezichthouders', 'Advocatuur', 'Maatschappelijke organisaties', 'Bedrijven', 'Overig'] as const;
const categoryLabels: Record<string, string> = { Ministerie: 'Ministeries', Gemeente: 'Gemeenten', Brancheorganisatie: 'Branche- en koepelorganisaties' };
export const categoryLabel = (value: string) => categoryLabels[value] ?? value;
export const contactRoles = ['Kamerleden', 'Kamermedewerkers', 'Burgemeesters', 'Beleidsmedewerkers en adviseurs', 'Bestuur, directie en management', 'Advocaten en juristen', 'Secretariaten en griffies', 'Team- en algemene adressen', 'Overige functies', 'Functie onbekend'] as const;
export type ContactRole = typeof contactRoles[number];
/** Conservative role grouping from the stored position text only; the original text stays visible. */
export function contactRole(contact: { name: string; position: string }): ContactRole {
  const p = contact.position.trim().toLocaleLowerCase('nl');
  if (!p) {
    const n = contact.name.trim().toLocaleLowerCase('nl');
    if (/secretariaat|griffie/.test(n)) return 'Secretariaten en griffies';
    if (/(^|[\s-])(team|office|kabinet)([\s-]|$)|algemeen/.test(n)) return 'Team- en algemene adressen';
    return 'Functie onbekend';
  }
  if (/kamerlid|kamerleden|fractie/.test(p) && /medewerker|assistent|ondersteun|adviseur|advisor|staf/.test(p)) return 'Kamermedewerkers';
  if (/^(tweede |eerste |tweede-|eerste-)?kamerlid\b/.test(p) || /\b(tweede|eerste)[ -]kamerlid\b/.test(p) || /^lid (van de )?(tweede|eerste) kamer\b/.test(p)) return 'Kamerleden';
  if (/secretariaat|secretaresse|griffie|griffier|management ?assistent/.test(p)) return 'Secretariaten en griffies';
  if (/beleidsmedewerker|beleidsadviseur|beleidsambtenaar|adviseur|advisor|policy officer|public affairs/.test(p)) return 'Beleidsmedewerkers en adviseurs';
  if (/^(loco-)?burgemeester\b/.test(p)) return 'Burgemeesters';
  if (/advocaat|advocate|jurist|juridisch|lawyer|counsel|legal/.test(p)) return 'Advocaten en juristen';
  if (/\b(head|hoofd|directeur|director|directie|voorzitter|chair|chairman|ceo|cfo|coo|chief|manager|management|bestuurder|bestuurslid|president|secretaris-generaal|directeur-generaal)\b/.test(p)) return 'Bestuur, directie en management';
  if (/(^|[\s-])(team|office|kabinet)([\s-]|$)|algemeen/.test(p)) return 'Team- en algemene adressen';
  return 'Overige functies';
}
export type Organization = Database['public']['Tables']['address_book_organizations']['Row'];
export type Contact = Database['public']['Tables']['address_book_contacts']['Row'];
export type OrganizationInput = Omit<Organization, 'id' | 'created_at'>;
export type ContactInput = Omit<Contact, 'id' | 'created_at'>;
export type AddressBook = { organizations: Organization[]; contacts: Contact[] };
export const emptyOrganization: OrganizationInput = { name: '', abbreviation: '', category: 'Overig', email: '', phone: '', website: '', address: '', postal_code: '', city: '', note: '' };
export const emptyContact = { name: '', position: '', department: '', email: '', phone: '', note: '' };
export function canManageAddressBook(auth: { user: unknown; loading: boolean; authError: string | null; isAdmin: boolean; isBoard: boolean; isExtern: boolean }) {
  return !!auth.user && !auth.loading && !auth.authError && !auth.isExtern && (auth.isAdmin || auth.isBoard);
}
export function safeWebsite(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}
export function searchAddressBook(data: AddressBook, query: string, category: string, role = '') {
  const needle = query.trim().toLocaleLowerCase('nl');
  const matches = (...values: string[]) => values.some(v => v.toLocaleLowerCase('nl').includes(needle));
  const allowed = data.organizations.filter(o => !category || o.category === category);
  const ids = new Set(allowed.map(o => o.id));
  const orgNames = new Map(data.organizations.map(o => [o.id, o]));
  const people = data.contacts.filter(c => ids.has(c.organization_id) && (!role || contactRole(c) === role)
    && (matches(c.name, c.position, c.department, c.email) || (!!role && !!needle && matches(orgNames.get(c.organization_id)?.name ?? '', orgNames.get(c.organization_id)?.abbreviation ?? ''))));
  const peopleIds = new Set(people.map(c => c.organization_id));
  return {
    organizations: allowed.filter(o => role ? peopleIds.has(o.id) : (matches(o.name, o.abbreviation, o.email) || peopleIds.has(o.id))).sort((a, b) => a.name.localeCompare(b.name, 'nl')),
    contacts: people.sort((a, b) => a.name.localeCompare(b.name, 'nl')),
  };
}
export function cleanFields<T extends Record<string, string>>(input: T): T {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.trim()])) as T;
}
