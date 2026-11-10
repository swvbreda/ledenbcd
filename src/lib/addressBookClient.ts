import { queryOptions } from '@tanstack/react-query';
import { boundedSignal, callerSupabase } from './callerClient';
import type { AddressBook, ContactInput, OrganizationInput } from './addressBook';

export const ADDRESS_BOOK_TIMEOUT_MS = 20_000;
const LOAD_ERROR = 'Contacten konden niet worden geladen. Probeer opnieuw.';

type Table = 'address_book_organizations' | 'address_book_contacts';
async function readAll(table: Table, signal: AbortSignal) {
  const db = await callerSupabase();
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db.from(table).select('*').order('id').range(start, start + 499).abortSignal(signal);
    if (error) throw new Error(signal.aborted ? 'Contacten reageerden niet op tijd. Probeer opnieuw.' : LOAD_ERROR);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export const addressBookQuery = (userId: string) => queryOptions({
  queryKey: ['internal-address-book', userId],
  queryFn: async ({ signal }): Promise<AddressBook> => {
    if (!userId) throw new Error('Log opnieuw in om Contacten te openen.');
    const bounded = boundedSignal(ADDRESS_BOOK_TIMEOUT_MS, signal);
    const timeout = new Promise<never>((_, reject) => bounded.addEventListener('abort', () => reject(new Error('Contacten reageerden niet op tijd. Probeer opnieuw.')), { once: true }));
    const [organizations, contacts] = await Promise.race([
      Promise.all([readAll('address_book_organizations', bounded), readAll('address_book_contacts', bounded)]),
      timeout,
    ]);
    return { organizations: organizations as AddressBook['organizations'], contacts: contacts as AddressBook['contacts'] };
  },
  staleTime: 0, retry: false,
});
export async function saveAddressRecord(table: Table, values: OrganizationInput | ContactInput, id?: string) {
  const supabase = await callerSupabase();
  const request = table === 'address_book_contacts' && 'organization_id' in values
    ? (id ? supabase.from('address_book_contacts').update(values).eq('id', id) : supabase.from('address_book_contacts').insert(values))
    : table === 'address_book_organizations' && 'category' in values
      ? (id ? supabase.from('address_book_organizations').update(values).eq('id', id) : supabase.from('address_book_organizations').insert(values))
      : null;
  if (!request) throw new Error('Niet opgeslagen: ongeldige contactgegevens.');
  const { data, error } = await request.select('id').single();
  if (error || !data?.id) throw new Error('Niet opgeslagen. Controleer je toegang en probeer opnieuw.');
  return data.id;
}
export async function deleteAddressRecord(table: Table, id: string) {
  const supabase = await callerSupabase();
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id').single();
  if (error || data?.id !== id) throw new Error('Niet verwijderd. Controleer je toegang en probeer opnieuw.');
}
