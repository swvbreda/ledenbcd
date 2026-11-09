import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AddressBookPage from '../AddressBookPage';
import { emptyContact, emptyOrganization, type AddressBook, type Contact } from '@/lib/addressBook';
import { downloadAddressFile } from '@/lib/addressBookExport';

const organization = (id: string, name: string, category: string) => ({
  ...emptyOrganization, id, name, category, created_at: '',
});
const contact = (id: string, name: string, values: Partial<Contact>): Contact => ({
  ...emptyContact, id, name, created_at: '', organization_id: 'tk', ...values,
});
const data: AddressBook = {
  organizations: [
    { ...organization('tk', 'SYNTH Tweede Kamer', 'Tweede Kamer'), email: 'algemeen@example.invalid' },
    organization('ek', 'SYNTH Eerste Kamer', 'Eerste Kamer'),
    organization('min', 'SYNTH Ministerie', 'Ministerie'),
  ],
  contacts: [
    contact('ada', 'SYNTH Ada', {
      party: 'SYNTH Partij A', position: 'Tweede Kamerlid', email: 'ada@example.invalid',
      committees: 'Financiën (lid)\nJustitie en Veiligheid (plaatsvervangend lid)',
    }),
    contact('bea', 'SYNTH Bea', {
      party: 'SYNTH Partij B', position: 'Tweede Kamerlid', email: 'bea@example.invalid',
      committees: 'Financiën (plaatsvervangend lid)',
    }),
    contact('cor', 'SYNTH Cor', {
      party: 'SYNTH Partij A', position: 'Beleidsmedewerker', email: 'cor@example.invalid',
      policy_areas: 'Cannabisbeleid\nFinanciën',
    }),
    contact('dana', 'SYNTH Dana', {
      party: undefined, committees: undefined, policy_areas: undefined,
      position: 'Contactpersoon', email: 'dana@example.invalid',
    }),
    contact('sena', 'SYNTH Sena', {
      organization_id: 'ek', party: 'SYNTH Partij C', position: 'Eerste Kamerlid',
      email: 'sena@example.invalid', committees: 'Justitie en Veiligheid (lid)',
    }),
    contact('mien', 'SYNTH Mien', {
      organization_id: 'min', position: 'Beleidsadviseur', email: 'mien@example.invalid',
    }),
  ],
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u' }, loading: false, authError: null, isAdmin: true, isBoard: false, isExtern: false }),
}));
vi.mock('@/lib/addressBookClient', () => ({
  addressBookQuery: (userId: string) => ({ queryKey: ['ab', userId], queryFn: async () => data }),
  saveAddressRecord: vi.fn(), deleteAddressRecord: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, hash }: { children: ReactNode; params?: { id: string }; hash?: string }) =>
    <a href={`/contacten/${params?.id ?? ''}${hash ? `#${hash}` : ''}`}>{children}</a>,
  useNavigate: () => vi.fn(),
}));
// Keep the real scope, e-mail and CSV implementations; only suppress the browser download.
vi.mock('@/lib/addressBookExport', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/addressBookExport')>(),
  downloadAddressFile: vi.fn(),
}));

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.clearAllMocks();
});
const setup = (props: Record<string, string> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clients.push(client);
  client.setQueryData(['ab', 'u'], data);
  const page = (next: Record<string, string>) =>
    <QueryClientProvider client={client}><AddressBookPage category="Tweede Kamer" {...next} /></QueryClientProvider>;
  const result = render(page(props));
  return { ...result, update: (next: Record<string, string>) => result.rerender(page(next)) };
};
const groupHead = (name: string, count: number) => screen.getByRole('button', {
  name: `${name} ${count} ${count === 1 ? 'contactpersoon' : 'contactpersonen'}`,
});
const categoryHead = (name: RegExp) => screen.getAllByRole('button', { name })
  .find(button => button.getAttribute('aria-controls')?.startsWith('categorie-'))!;
const exportSummary = () => screen.getByLabelText('Export Contacten');
const clipboard = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return writeText;
};

describe('Tweede Kamer grouping in the real address book', () => {
  it('defaults to collapsed parties and reveals the existing function and e-mail columns', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Per partij' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Per commissie' }).getAttribute('aria-pressed')).toBe('false');
    expect(groupHead('SYNTH Partij A', 2).getAttribute('aria-expanded')).toBe('false');
    expect(groupHead('SYNTH Partij B', 1).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('SYNTH Ada')).toBeNull();

    fireEvent.click(groupHead('SYNTH Partij A', 2));
    const table = screen.getByRole('table', { name: 'Tweede Kamer — partij SYNTH Partij A' });
    const row = within(table).getByText('SYNTH Ada').closest('tr')!;
    expect(within(row).getByText('Tweede Kamerlid')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'ada@example.invalid' }).getAttribute('href')).toBe('mailto:ada@example.invalid');
    expect(within(table).getByText('Beleidsmedewerker')).toBeTruthy();
    expect(screen.queryByText('SYNTH Bea')).toBeNull();
    fireEvent.click(groupHead('SYNTH Partij A', 2));
    expect(screen.queryByText('SYNTH Ada')).toBeNull();
  });

  it('merges membership variants and synchronizes repeated people while exporting each person once', async () => {
    const writeText = clipboard();
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Per commissie' }));
    expect(screen.getByRole('button', { name: 'Per commissie' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('button', { name: /^Financiën / })).toHaveLength(1);
    fireEvent.click(groupHead('Financiën', 2));
    fireEvent.click(groupHead('Justitie en Veiligheid', 1));

    const adaChoices = screen.getAllByRole('checkbox', { name: 'Selecteer SYNTH Ada' });
    expect(adaChoices).toHaveLength(2);
    fireEvent.click(adaChoices[0]);
    expect(screen.getAllByRole('checkbox', { name: 'Selecteer SYNTH Ada' }).map(c => c.getAttribute('data-state'))).toEqual(['checked', 'checked']);
    expect(screen.getByRole('checkbox', { name: 'Selecteer alle contactpersonen in Financiën' }).getAttribute('data-state')).toBe('indeterminate');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecteer SYNTH Bea' }));
    expect(exportSummary().textContent).toContain('selectie · 2 contactpersonen');
    expect(exportSummary().textContent).toContain('2 bruikbare unieke e-mailadressen');

    fireEvent.click(screen.getByRole('button', { name: 'E-mailadressen kopiëren' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('ada@example.invalid; bea@example.invalid'));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Exporteren' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Contacten (.csv)' }));
    expect(downloadAddressFile).toHaveBeenCalledTimes(1);
    const [csv, extension] = vi.mocked(downloadAddressFile).mock.calls[0];
    expect(extension).toBe('csv');
    expect(csv.match(/"SYNTH Ada"/g)).toHaveLength(1);
    expect(csv.match(/"SYNTH Bea"/g)).toHaveLength(1);
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3);
    expect(csv).not.toContain('SYNTH Cor');
    expect(csv).not.toContain('algemeen@example.invalid');
  });

  it('selects a closed party and retains the same selection through collapsing and changing grouping', () => {
    setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecteer alle contactpersonen in SYNTH Partij A' }));
    expect(screen.queryByText('SYNTH Ada')).toBeNull();
    expect(exportSummary().textContent).toContain('selectie · 2 contactpersonen');
    fireEvent.click(groupHead('SYNTH Partij A', 2));
    expect(screen.getByRole('checkbox', { name: 'Selecteer SYNTH Cor' }).getAttribute('data-state')).toBe('checked');
    fireEvent.click(groupHead('SYNTH Partij A', 2));

    fireEvent.click(screen.getByRole('button', { name: 'Per commissie' }));
    fireEvent.click(groupHead('Financiën', 2));
    expect(screen.getByRole('checkbox', { name: 'Selecteer SYNTH Ada' }).getAttribute('data-state')).toBe('checked');
    expect(screen.getByRole('checkbox', { name: 'Selecteer SYNTH Bea' }).getAttribute('data-state')).toBe('unchecked');
    expect(exportSummary().textContent).toContain('selectie · 2 contactpersonen');
    fireEvent.click(categoryHead(/^Tweede Kamer /));
    expect(exportSummary().textContent).toContain('selectie · 2 contactpersonen');
    fireEvent.click(categoryHead(/^Tweede Kamer /));
    expect(screen.getByRole('button', { name: 'Per commissie' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Per partij' }));
    expect(screen.getByRole('checkbox', { name: 'Selecteer alle contactpersonen in SYNTH Partij A' }).getAttribute('data-state')).toBe('checked');
    fireEvent.click(groupHead('SYNTH Partij A', 2));
    expect(screen.getByRole('checkbox', { name: 'Selecteer SYNTH Ada' }).getAttribute('data-state')).toBe('checked');
    expect(screen.getByRole('checkbox', { name: 'Selecteer SYNTH Cor' }).getAttribute('data-state')).toBe('checked');
  });

  it('opens matching groups for a person or committee search and exports only the filtered people', async () => {
    const writeText = clipboard();
    const { update } = setup({ query: 'ada' });
    expect(groupHead('SYNTH Partij A', 1).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('SYNTH Ada')).toBeTruthy();
    expect(screen.queryByText('SYNTH Cor')).toBeNull();
    expect(screen.queryByText('SYNTH Bea')).toBeNull();
    expect(exportSummary().textContent).toContain('alle resultaten · 1 contactpersoon');
    fireEvent.click(screen.getByRole('button', { name: 'E-mailadressen kopiëren' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('ada@example.invalid'));

    update({ query: 'Financiën' });
    fireEvent.click(screen.getByRole('button', { name: 'Per commissie' }));
    expect(groupHead('Financiën', 2).getAttribute('aria-expanded')).toBe('true');
    expect(groupHead('Justitie en Veiligheid', 1).getAttribute('aria-expanded')).toBe('false');
    expect(groupHead('Geen commissie vastgelegd', 1).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByText('SYNTH Ada')).toHaveLength(1);
    expect(screen.getByText('SYNTH Bea')).toBeTruthy();
    // A policy match stays visible without falsely becoming a committee member.
    expect(screen.getByText('SYNTH Cor')).toBeTruthy();
    expect(screen.queryByText('SYNTH Dana')).toBeNull();
    expect(exportSummary().textContent).toContain('alle resultaten · 3 contactpersonen');
  });

  it('keeps missing fields in fallback groups and never promotes policy areas to committees', () => {
    setup();
    fireEvent.click(groupHead('Geen partij vastgelegd', 1));
    expect(screen.getByText('SYNTH Dana')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Per commissie' }));
    expect(screen.queryByRole('button', { name: /Cannabisbeleid/ })).toBeNull();
    fireEvent.click(groupHead('Geen commissie vastgelegd', 2));
    expect(screen.getByText('SYNTH Dana')).toBeTruthy();
    expect(screen.getByText('SYNTH Cor')).toBeTruthy();
    expect(screen.getByText('Cannabisbeleid')).toBeTruthy();
    expect(screen.getByText('Beleidsterreinen')).toBeTruthy();
    expect(exportSummary().textContent).toContain('alle resultaten · 4 contactpersonen');
  });

  it('keeps other categories and the Tweede Kamer detail page outside the new grouping', () => {
    const { update } = setup({ category: '' });
    fireEvent.click(categoryHead(/^Eerste Kamer /));
    expect(screen.getByRole('table', { name: 'Contactpersonen: Eerste Kamer' })).toBeTruthy();
    expect(screen.getByText('SYNTH Sena')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Per partij' })).toBeNull();
    fireEvent.click(categoryHead(/^Ministeries /));
    expect(screen.getByRole('table', { name: 'Ministeries: algemene gegevens' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Per commissie' })).toBeNull();

    update({ id: 'tk', category: '' });
    expect(screen.queryByRole('button', { name: 'Per partij' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Per commissie' })).toBeNull();
    const table = screen.getByRole('table', { name: 'Contactpersonen van SYNTH Tweede Kamer' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Bewerk SYNTH Ada' })).toBeTruthy();
    expect(document.getElementById('persoon-ada')?.tagName).toBe('TR');
    expect(exportSummary().textContent).toContain('alle resultaten · 4 contactpersonen');
  });

  it('places copy, export and add organization together above the filters with one export toolbar', () => {
    setup();
    expect(screen.getAllByLabelText('Export Contacten')).toHaveLength(1);
    const copy = screen.getByRole('button', { name: 'E-mailadressen kopiëren' });
    const exportButton = screen.getByRole('button', { name: 'Exporteren' });
    const add = screen.getByRole('button', { name: 'Organisatie toevoegen' });
    const actionRow = copy.parentElement!;
    expect(actionRow.contains(exportButton)).toBe(true);
    expect(actionRow.contains(add)).toBe(true);
    expect(actionRow.compareDocumentPosition(screen.getByRole('textbox', { name: 'Zoek contacten' })) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });
});
