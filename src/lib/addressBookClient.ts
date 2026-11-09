import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AddressBook, ContactInput, OrganizationInput } from './addressBook';

type Table = 'address_book_organizations' | 'address_book_contacts';
async function readAll(table: Table, signal?: AbortSignal) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    let request = supabase.from(table).select('*').order('id').range(start, start + 499);
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    if (error) throw new Error('Contacten konden niet worden geladen. Probeer opnieuw.');
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export const addressBookQuery = (userId: string) => queryOptions({
  queryKey: ['internal-address-book', userId],
  queryFn: async ({ signal }): Promise<AddressBook> => {
    if (!userId) throw new Error('Log opnieuw in om Contacten te openen.');
    const [organizations, contacts] = await Promise.all([readAll('address_book_organizations', signal), readAll('address_book_contacts', signal)]);
    return { organizations: organizations as AddressBook['organizations'], contacts: contacts as AddressBook['contacts'] };
  },
  staleTime: 0, retry: false,
});
export async function saveAddressRecord(table: Table, values: OrganizationInput | ContactInput, id?: string) {
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
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id').single();
  if (error || data?.id !== id) throw new Error('Niet verwijderd. Controleer je toegang en probeer opnieuw.');
}
