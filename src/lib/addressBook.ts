import type { Database } from '@/integrations/supabase/types';

export const addressCategories = ['Tweede Kamer', 'Eerste Kamer', 'Ministerie', 'Gemeente', 'Brancheorganisatie', 'Banken', 'Betalingsverkeer', 'Toezichthouders', 'Advocatuur', 'Maatschappelijke organisaties', 'Bedrijven', 'Overig'] as const;
const categoryLabels: Record<string, string> = { Ministerie: 'Ministeries', Gemeente: 'Gemeenten', Brancheorganisatie: 'Branche- en koepelorganisaties' };
export const categoryLabel = (value: string) => categoryLabels[value] ?? value;
export const contactRoles = ['Kamerleden', 'Kamermedewerkers', 'Burgemeesters', 'Beleidsmedewerkers en adviseurs', 'Bestuur, directie en management', 'Advocaten en juristen', 'Secretariaten en griffies', 'Team- en algemene adressen', 'Overige functies', 'Functie onbekend'] as const;
export type ContactRole = typeof contactRoles[number];
/** Conservative role grouping from the stored position text only; the original text stays visible. */
export function contactRole(contact: { name: string; position: string }, category = ''): ContactRole {
  const p = contact.position.trim().toLocaleLowerCase('nl');
  const n = contact.name.trim().toLocaleLowerCase('nl');
  const kamer = category === 'Tweede Kamer' || category === 'Eerste Kamer';
  const teamName = /\((teamadres|functieadres)\)/.test(n);
  if (!p) {
    if (/secretariaat|griffie/.test(n)) return 'Secretariaten en griffies';
    if (teamName || /(^|[\s-])(team|office|kabinet)([\s-]|$)/.test(n)) return 'Team- en algemene adressen';
    return 'Functie onbekend';
  }
  if (kamer && /^(beleidsmedewerker|persoonlijk medewerker|fractiemedewerker|medewerker|assistent|ondersteun)/.test(p)) return 'Kamermedewerkers';
  if (/kamerlid/.test(p) && /medewerker|assistent|ondersteun/.test(p)) return 'Kamermedewerkers';
  if (category === 'Tweede Kamer' && /^tweede[ -]kamerlid\b/.test(p)) return 'Kamerleden';
  if (category === 'Eerste Kamer' && /^(eerste[ -]kamerlid|lid (van de )?eerste kamer)\b/.test(p)) return 'Kamerleden';
  if (/secretariaat|secretaresse|griffie|griffier|management ?assistent/.test(p)) return 'Secretariaten en griffies';
  if (/^(loco-)?burgemeester\b/.test(p)) return 'Burgemeesters';
  if (/beleidsmedewerker|beleidsadviseur|beleidsambtenaar|adviseur|advisor|policy officer|public affairs/.test(p)) return 'Beleidsmedewerkers en adviseurs';
  if (/advocaat|advocate|jurist|juridisch|lawyer|counsel|legal/.test(p)) return 'Advocaten en juristen';
  if (/\b(head|hoofd|directeur|director|directie|voorzitter|chair|chairman|ceo|cfo|coo|chief|manager|management|bestuurder|bestuurslid|president|secretaris-generaal|directeur-generaal)\b/.test(p)) return 'Bestuur, directie en management';
  if (/functioneel contactadres|functieadres|teamadres/.test(p) || teamName) return 'Team- en algemene adressen';
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
  const people = data.contacts.filter(c => ids.has(c.organization_id) && (!role || contactRole(c, orgNames.get(c.organization_id)?.category) === role)
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
// Automatic source/provenance paragraphs stay stored for review but are hidden on cards.
const sourceStart = /^\s*(bron|bronnen|mailbron|aanvullende bron|brongegevens)\s*:/i;
const sourceLine = /outlook\.(cloud\.)?(microsoft|office|live)\.com?|outlook\.cloud\.microsoft|\b(gecontroleerd|vastgelegd|geraadpleegd|overgenomen) op \d/i;
export function visibleNote(note: string): string {
  // A paragraph that starts as a source block is dropped entirely (incl. its follow-up lines);
  // in other paragraphs only individual provenance lines are removed.
  return (note ?? '').split(/\n\s*\n/).filter(p => !sourceStart.test(p))
    .map(p => p.split('\n').filter(l => !sourceStart.test(l) && !sourceLine.test(l)).join('\n').trim()).filter(Boolean).join('\n\n');
}
export function groupByCategory<T extends { category: string; name: string }>(organizations: T[]) {
  // Unknown stored categories get their own group at the end instead of disappearing.
  const known = new Set<string>(addressCategories);
  const extra = [...new Set(organizations.map(o => o.category).filter(c => !known.has(c)))].sort((a, b) => a.localeCompare(b, 'nl'));
  return [...addressCategories, ...extra].map(category => ({ category, items: organizations.filter(o => o.category === category).sort((a, b) => a.name.localeCompare(b.name, 'nl')) })).filter(g => g.items.length);
}
