import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AddressForm } from '../contacten/AddressForm';
import { EmailLink } from '../contacten/ContactLinks';
import { addressCategories, canManageAddressBook, emptyOrganization, searchAddressBook, safeWebsite, type AddressBook } from '@/lib/addressBook';
import { saveAddressRecord, deleteAddressRecord } from '@/lib/addressBookClient';
const m = vi.hoisted(() => ({ single: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: m.toastSuccess, error: m.toastError } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => { const chain = { insert: () => chain, update: () => chain, delete: () => chain, eq: () => chain, select: () => chain, single: m.single }; return chain; } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const org = { ...emptyOrganization, id: 'org-a', created_at: '', name: 'SYNTHETISCH Ministerie', abbreviation: 'SM', category: 'Ministerie' };
const data: AddressBook = { organizations: [org], contacts: [{ id: 'c-a', created_at: '', organization_id: org.id, name: 'SYNTHETISCH Ada', position: 'Beleidsadviseur', department: 'Fractie S', email: 'ada@example.invalid', phone: '', note: '' }, { id: 'c-b', created_at: '', organization_id: org.id, name: 'SYNTHETISCH Bob', position: 'Secretaris', department: '', email: 'bob@example.invalid', phone: '', note: '' }] };
describe('address book rules', () => {
 it('editing never submits id or created_at as editable fields', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<AddressForm title="Organisatie bewerken" initial={{ ...org }} organization onSave={save} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).not.toHaveProperty('id');
  expect(save.mock.calls[0][0]).not.toHaveProperty('created_at');
 });
 it.each(['ADA','BELEIDSADVISEUR','ADA@EXAMPLE.INVALID','FRACTIE S'])('searches person fields without case sensitivity: %s', query => { const result = searchAddressBook(data, query, ''); expect(result.contacts.map(c => c.id)).toEqual(['c-a']); expect(result.organizations.map(o => o.id)).toEqual(['org-a']); });
 it('searches organizations and abbreviation and respects category', () => { expect(searchAddressBook(data, 'sm', '').organizations).toHaveLength(1); expect(searchAddressBook(data, 'ada', 'Tweede Kamer').contacts).toHaveLength(0); });
 it('uses the six approved categories and Overig default', () => { expect(addressCategories).toEqual(expect.arrayContaining(['Tweede Kamer','Eerste Kamer','Ministerie','Gemeente','Brancheorganisatie','Overig','Banken','Betalingsverkeer','Toezichthouders','Advocatuur','Maatschappelijke organisaties','Bedrijven'])); expect(addressCategories).toHaveLength(12); expect(emptyOrganization.category).toBe('Overig'); });
 it('requires checked admin or board rights; denies ordinary/extern/unresolved', () => {
 const auth = { user: {}, loading: false, authError: null, isAdmin: false, isBoard: false, isExtern: false };
 expect(canManageAddressBook(auth)).toBe(false); expect(canManageAddressBook({ ...auth, isAdmin: true })).toBe(true); expect(canManageAddressBook({ ...auth, isBoard: true })).toBe(true);
 expect(canManageAddressBook({ ...auth, isBoard: true, loading: true })).toBe(false); expect(canManageAddressBook({ ...auth, isBoard: true, isExtern: true })).toBe(false); expect(canManageAddressBook({ ...auth, isAdmin: true, authError: 'error' })).toBe(false);
 });
 it('allows http/https only and denies executable or credential-bearing links', () => { expect(safeWebsite('example.org')).toBe('https://example.org/'); expect(safeWebsite('http://example.org')).toBe('http://example.org/'); expect(safeWebsite('javascript:alert(1)')).toBeNull(); expect(safeWebsite('https://a:b@example.org')).toBeNull(); });
 it('save and deletion fail if no matching row is returned', async () => { m.single.mockResolvedValue({ data: null, error: null }); await expect(saveAddressRecord('address_book_organizations', emptyOrganization)).rejects.toThrow('Niet opgeslagen'); await expect(deleteAddressRecord('address_book_contacts', 'c-a')).rejects.toThrow('Niet verwijderd'); });
 it('uses the persisted row id after save', async () => { m.single.mockResolvedValue({ data: { id: 'persisted-id' }, error: null }); expect(await saveAddressRecord('address_book_organizations', { ...emptyOrganization, name: 'SYNTHETISCH' })).toBe('persisted-id'); });
 it('submits only after saving; leaves errors and form open when persistence fails', async () => { const save = vi.fn().mockRejectedValue(new Error('Niet opgeslagen')); const close = vi.fn(); render(<AddressForm title="Organisatie toevoegen" initial={{ ...emptyOrganization }} organization onSave={save} onClose={close} />); fireEvent.change(screen.getByLabelText('Naam *'), { target: { value: ' SYNTHETISCH Test ' } }); fireEvent.click(screen.getByRole('button', { name: 'Opslaan' })); await screen.findByRole('alert'); expect(close).not.toHaveBeenCalled(); expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'SYNTHETISCH Test', category: 'Overig' })); });
 it('contact form needs no account link and supports two separate people', async () => { const save = vi.fn().mockResolvedValue(undefined); const close = vi.fn(); render(<AddressForm title="Contactpersoon toevoegen" initial={{ name: '', position: '', department: '', email: '', phone: '', note: '' }} organization={false} onSave={save} onClose={close} />); fireEvent.change(screen.getByLabelText('Naam *'), { target: { value: 'SYNTHETISCH Persoon' } }); fireEvent.click(screen.getByRole('button', { name: 'Opslaan' })); await waitFor(() => expect(close).toHaveBeenCalledOnce()); expect(save).toHaveBeenCalledWith({ name: 'SYNTHETISCH Persoon', position: '', department: '', email: '', phone: '', note: '' }); });
 it('copies email and reports both clipboard outcomes', async () => { const writeText = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator,'clipboard',{ value: { writeText }, configurable: true }); render(<EmailLink email="synthetic@example.invalid" />); fireEvent.click(screen.getByRole('button')); await waitFor(() => expect(m.toastSuccess).toHaveBeenCalled()); expect(writeText).toHaveBeenCalledWith('synthetic@example.invalid'); writeText.mockRejectedValue(new Error('denied')); fireEvent.click(screen.getByRole('button')); await waitFor(() => expect(m.toastError).toHaveBeenCalled()); });
});
