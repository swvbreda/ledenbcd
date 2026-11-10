import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AddressBookPage from '../AddressBookPage';
import { emptyContact, emptyOrganization } from '@/lib/addressBook';
import { getAuthBearer, resetAuthBearerForTests, setAuthBearer } from '@/lib/authBearer';

// Only authentication and navigation are substituted. The real page, query,
// caller client and Supabase/PostgREST transport remain in the integration path.
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({
  user: { id: 'synthetic-viewer' }, loading: false, authError: null,
  isAdmin: true, isBoard: false, isExtern: false,
}) }));
vi.mock('@/lib/supabaseAuthAttacher', () => ({
  AUTH_TRANSPORT_RETRY_MESSAGE: 'Je sessie is gewijzigd. Probeer opnieuw.',
  resolveBearer: async () => getAuthBearer().token,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, hash }: { children: ReactNode; params?: { id: string }; hash?: string }) =>
    <a href={`/contacten/${params?.id ?? ''}${hash ? `#${hash}` : ''}`}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

let client: QueryClient | undefined;
afterEach(() => {
  cleanup();
  client?.clear();
  resetAuthBearerForTests();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('loads the real overview and organization detail through the caller client without a seeded query cache', async () => {
  const origin = 'https://bcd-fixture.example.invalid';
  const token = 'synthetic-access-token';
  vi.stubEnv('VITE_SUPABASE_URL', origin);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key');
  setAuthBearer(token);
  const organization = { ...emptyOrganization, id: 'synthetic-org', created_at: '', name: 'SYNTH Ministerie', category: 'Ministerie' };
  const contact = { ...emptyContact, id: 'synthetic-person', organization_id: organization.id, created_at: '', name: 'SYNTH Ada', position: 'Beleidsadviseur', email: 'ada@example.invalid' };
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requests: { pathname: string; authorization: string | null }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const inputRequest = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const url = new URL(inputRequest ? inputRequest.url : String(input));
    const headers = new Headers(init?.headers ?? inputRequest?.headers);
    if (url.origin !== origin || !['/rest/v1/address_book_organizations', '/rest/v1/address_book_contacts'].includes(url.pathname)) {
      throw new Error('Unexpected network request in synthetic contact test');
    }
    requests.push({ pathname: url.pathname, authorization: headers.get('authorization') });
    await gate;
    const rows = url.pathname.endsWith('address_book_organizations') ? [organization] : [contact];
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  client = new QueryClient();
  const page = (id?: string) => <QueryClientProvider client={client!}><AddressBookPage id={id} query={id ? '' : 'SYNTH Ada'} /></QueryClientProvider>;
  const view = render(page());
  expect(screen.getByRole('status').textContent).toBe('Contacten laden…');
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests.every(request => request.authorization === `Bearer ${token}`)).toBe(true);
  release();
  await screen.findByText(contact.name);
  expect(screen.queryByRole('status')).toBeNull();
  const overview = screen.getByRole('table', { name: 'Contactpersonen van SYNTH Ministerie' });
  expect(within(overview).getByText(contact.position)).toBeTruthy();
  expect(within(overview).getByText(contact.email)).toBeTruthy();
  view.rerender(page(organization.id));
  await screen.findByRole('heading', { name: organization.name });
  const detail = screen.getByRole('table', { name: 'Contactpersonen van SYNTH Ministerie' });
  expect(within(detail).getByText(contact.name).closest('tr')?.id).toBe('persoon-synthetic-person');
  expect(within(detail).getByRole('button', { name: 'Bewerk SYNTH Ada' })).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
