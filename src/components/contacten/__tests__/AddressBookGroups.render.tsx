import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AddressBookPage from '../AddressBookPage';
import { emptyOrganization, type AddressBook } from '@/lib/addressBook';
const o = (id: string, name: string, category: string) => ({ ...emptyOrganization, id, created_at: '', name, category });
const data: AddressBook = {
  organizations: [o('1', 'SYNTH Gemeente B', 'Gemeente'), o('2', 'SYNTH Gemeente A', 'Gemeente'), o('3', 'SYNTH Ministerie', 'Ministerie')],
  contacts: [{ id: 'c', created_at: '', organization_id: '3', name: 'SYNTH Ada', position: '', department: 'DGX', email: '', phone: '', note: 'Mailbron: x\nhttps://outlook.cloud.microsoft/mail/id/Q\n\nBel liever.' }],
};
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u' }, loading: false, authError: null, isAdmin: true, isBoard: false, isExtern: false }) }));
vi.mock('@/lib/addressBookClient', () => ({ addressBookQuery: (u: string) => ({ queryKey: ['ab', u], queryFn: async () => data }), saveAddressRecord: vi.fn(), deleteAddressRecord: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>, useNavigate: () => vi.fn() }));
vi.mock('@/components/BcdHeroBanner', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));
afterEach(cleanup);
const setup = (props: Record<string, string> = {}) => { const qc = new QueryClient(); qc.setQueryData(['ab', 'u'], data); return { qc, ...render(<QueryClientProvider client={qc}><AddressBookPage {...props} /></QueryClientProvider>) }; };
const head = (n: RegExp) => screen.getByRole('button', { name: n });
describe('category groups in the real overview', () => {
  it('shows only non-empty groups with counts, all closed, and toggles manually', async () => {
    setup();
    expect(head(/Gemeente.*2/).getAttribute('aria-expanded')).toBe('false');
    expect(head(/Ministerie.*1/).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /Tweede Kamer/ })).toBeNull();
    expect(screen.queryByText('SYNTH Gemeente A')).toBeNull();
    fireEvent.click(head(/Gemeente/));
    const names = screen.getAllByText(/SYNTH Gemeente/).map(e => e.textContent);
    expect(names).toEqual(['SYNTH Gemeente A', 'SYNTH Gemeente B']);
    fireEvent.click(head(/Gemeente/));
    expect(screen.queryByText('SYNTH Gemeente A')).toBeNull();
  });
  it.each([[{ query: 'ada' }], [{ category: 'Ministerie' }], [{ role: 'Functie onbekend' }]])('active filter %o opens matching groups', async props => {
    setup(props);
    expect(head(/Ministerie/).getAttribute('aria-expanded')).toBe('true');
  });
  it('clearing filters collapses again; person card shows role placeholder without source', () => {
    const { qc, rerender } = setup({ query: 'ada' });
    expect(screen.getByText('Functie nog aan te vullen')).toBeTruthy();
    expect(screen.getByText('DGX')).toBeTruthy();
    rerender(<QueryClientProvider client={qc}><AddressBookPage /></QueryClientProvider>);
    expect(head(/Ministerie/).getAttribute('aria-expanded')).toBe('false');
  });
});
