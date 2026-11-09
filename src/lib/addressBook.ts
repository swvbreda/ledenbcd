import type { Database } from '@/integrations/supabase/types';

export const addressCategories = ['Tweede Kamer', 'Eerste Kamer', 'Ministerie', 'Gemeente', 'Brancheorganisatie', 'Overig'] as const;
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
export function searchAddressBook(data: AddressBook, query: string, category: string) {
  const needle = query.trim().toLocaleLowerCase('nl');
  const matches = (...values: string[]) => values.some(v => v.toLocaleLowerCase('nl').includes(needle));
  const allowed = data.organizations.filter(o => !category || o.category === category);
  const ids = new Set(allowed.map(o => o.id));
  const people = data.contacts.filter(c => ids.has(c.organization_id) && matches(c.name, c.position, c.department, c.email));
  const peopleIds = new Set(people.map(c => c.organization_id));
  return {
    organizations: allowed.filter(o => matches(o.name, o.abbreviation, o.email) || peopleIds.has(o.id)).sort((a, b) => a.name.localeCompare(b.name, 'nl')),
    contacts: people.sort((a, b) => a.name.localeCompare(b.name, 'nl')),
  };
}
export function cleanFields<T extends Record<string, string>>(input: T): T {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.trim()])) as T;
}
