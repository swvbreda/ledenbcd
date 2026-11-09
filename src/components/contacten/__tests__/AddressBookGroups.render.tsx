import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AddressBookPage from '../AddressBookPage';
import { emptyOrganization, type AddressBook } from '@/lib/addressBook';
const o = (id: string, name: string, category: string) => ({ ...emptyOrganization, id, created_at: '', name, category });
const data: AddressBook = {
  organizations: [o('1', 'SYNTH Gemeente B', 'Gemeente'), o('2', 'SYNTH Gemeente A', 'Gemeente'), o('3', 'SYNTH Ministerie', 'Ministerie')],
  contacts: [{ id: 'c', created_at: '', organization_id: '3', name: 'SYNTH Ada', position: '', department: 'DGX', email: '', phone: '', note: 'Mailbron: x\nhttps://outlook.cloud.microsoft/mail/id/Q\n\nBel liever.' },
    { id: 'd', created_at: '', organization_id: '3', name: 'SYNTH Bea', position: 'Beleidsadviseur', department: '', email: 'bea@example.invalid', phone: '0101', note: '' },
    { id: 'e', created_at: '', organization_id: '2', name: 'SYNTH Cor', position: 'Burgemeester', department: '', email: '', phone: '', note: '' }],
};
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u' }, loading: false, authError: null, isAdmin: true, isBoard: false, isExtern: false }) }));
vi.mock('@/lib/addressBookClient', () => ({ addressBookQuery: (u: string) => ({ queryKey: ['ab', u], queryFn: async () => data }), saveAddressRecord: vi.fn(), deleteAddressRecord: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children, params, hash }: { children: ReactNode; params?: { id: string }; hash?: string }) => <a href={`/contacten/${params?.id ?? ''}${hash ? `#${hash}` : ''}`}>{children}</a>, useNavigate: () => vi.fn() }));
vi.mock('@/components/BcdHeroBanner', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));
afterEach(cleanup);
const setup = (props: Record<string, string> = {}) => { const qc = new QueryClient(); qc.setQueryData(['ab', 'u'], data); return { qc, ...render(<QueryClientProvider client={qc}><AddressBookPage {...props} /></QueryClientProvider>) }; };
const head = (n: RegExp) => screen.getByRole('button', { name: n });
describe('category groups in the real overview', () => {
  it('shows only non-empty groups with counts, all closed, and toggles manually', async () => {
    setup();
    expect(head(/Gemeente.*2 organisaties · 1 contactpersoon/).getAttribute('aria-expanded')).toBe('false');
    expect(head(/Ministerie.*1 organisatie · 2 contactpersonen/).getAttribute('aria-expanded')).toBe('false');
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
  it('open category shows contact rows directly with function and mail', () => {
    setup(); fireEvent.click(head(/Ministerie/));
    const rows = screen.getAllByRole('row').map(r => r.textContent);
    expect(rows.some(t => /SYNTH Bea.*Beleidsadviseur.*bea@example.invalid.*0101/.test(t ?? ''))).toBe(true);
    expect(screen.getByText('SYNTH Ada').closest('a')?.getAttribute('href')).toBe('/contacten/3#persoon-c');
    expect(screen.getAllByRole('columnheader').map(h => h.textContent).slice(0, 5)).toEqual(['Naam', 'Functie', 'Afdeling', 'E-mail', 'Telefoon']);
    expect(screen.getByText('Bel liever.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Mailbron|outlook/);
  });
  it('org query without role lists its contacts and counts them', () => {
    setup({ query: 'synth ministerie' });
    expect(screen.getByText('SYNTH Ada')).toBeTruthy(); expect(screen.getByText('SYNTH Bea')).toBeTruthy();
    expect(screen.getByLabelText('Actieve filters').textContent).toMatch(/2 contactpersonen · 1 organisatie/);
  });
  it('person query or role filter shows only matches, no separate person section', () => {
    setup({ query: 'bea' });
    expect(screen.getByText('SYNTH Bea')).toBeTruthy(); expect(screen.queryByText('SYNTH Ada')).toBeNull();
    expect(screen.getAllByText('SYNTH Bea')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: /Contactpersonen \(/ })).toBeNull();
    cleanup(); setup({ role: 'Burgemeesters' });
    expect(screen.getByText('SYNTH Cor')).toBeTruthy(); expect(screen.queryByText('SYNTH Bea')).toBeNull();
    expect(screen.getByLabelText('Actieve filters').textContent).toMatch(/1 contactpersoon · 1 organisatie/);
  });
  it('detail page keeps person anchors and edit/delete actions in the table', () => {
    setup({ id: '3' });
    expect(document.getElementById('persoon-d')?.tagName).toBe('TR');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerk SYNTH Bea' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verwijder SYNTH Ada' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Mailbron/);
  });
});
