import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, afterEach } from 'vitest';
import BestuurOverzicht from '../BestuurOverzicht';
const mocks = vi.hoisted(() => ({ load: vi.fn(), rpc: vi.fn(), mobile: false }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/localSpokespeople.functions', () => ({ getLocalSpokespeople: mocks.load }));
vi.mock('@/lib/router-compat', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-viewer' } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, storage: { from: () => ({ list: async () => ({ data: [] }) }) } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.mobile = false; });
const people = [
  { name: 'Dhr. J. (Joachim) Helms', department: 'Amsterdam', email: 'Amsterdam@coffeeshopbond.nl' },
  { name: 'H. (Hannes) Poppinghaus', department: 'Arnhem', email: 'Arnhem@coffeeshopbond.nl' },
  { name: 'T. (Tugrulhan) Akca', department: 'Enschede', email: 'Enschede@coffeeshopbond.nl' },
  { name: 'Dhr. M. (Michel) Wouters', department: 'Rotterdam', email: 'Rotterdam@coffeeshopbond.nl' },
];
function mount() {
  mocks.rpc.mockResolvedValue({ data: [
    { id: 'national', naam: 'Joachim Helms', functie: 'Bestuurder / Woordvoerder', type: 'bestuurslid' },
    { id: 'local', naam: 'Hannes Poppinghaus', functie: 'Woordvoerder Arnhem', type: 'aspirant' },
    { id: 'other-local', naam: 'Tugrulhan Akca', functie: 'Woordvoerder Enschede', type: 'aspirant' },
  ] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}><BestuurOverzicht members={[]} /></QueryClientProvider>);
}
describe('department read integration', () => {
  it('reads the source separately without changing board records', async () => {
    mocks.load.mockResolvedValue({ people, source: 'https://coffeeshopbond.nl/over-ons' });
    mount();
    await screen.findByText('Dhr. M. (Michel) Wouters');
    expect(mocks.rpc).toHaveBeenCalledWith('get_board_members_public');
    expect(mocks.load).toHaveBeenCalled();
    expect(screen.getByText('Joachim Helms')).toBeTruthy();
    for (const person of people) {
      expect(screen.getByText(person.name)).toBeTruthy();
      expect(screen.getByRole('link', { name: person.email })).toHaveProperty('href', `mailto:${person.email}`);
    }
    expect(screen.queryByText('Hannes Poppinghaus')).toBeNull();
  });
  it('never substitutes the incomplete board roster on source failure', async () => {
    mocks.load.mockRejectedValue(new Error('offline')); mount();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Woordvoerders opnieuw laden' })).toBeTruthy());
    expect(screen.getByText('Joachim Helms')).toBeTruthy();
    expect(screen.queryByText('Hannes Poppinghaus')).toBeNull();
    expect(screen.queryByText('Tugrulhan Akca')).toBeNull();
    expect(screen.queryByText('Dhr. M. (Michel) Wouters')).toBeNull();
  });
  it('recovers all four departments through the existing retry control', async () => {
    mocks.load.mockRejectedValue(new Error('offline')); mount();
    const retry = await screen.findByRole('button', { name: 'Woordvoerders opnieuw laden' });
    mocks.load.mockResolvedValue({ people, source: 'https://coffeeshopbond.nl/over-ons' });
    fireEvent.click(retry);
    await screen.findByText('Dhr. M. (Michel) Wouters');
    for (const person of people) expect(screen.getByText(person.name)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('keeps all four departments in the mobile expansion', async () => {
    mocks.mobile = true;
    mocks.load.mockResolvedValue({ people, source: 'https://coffeeshopbond.nl/over-ons' }); mount();
    await screen.findByText('Dhr. M. (Michel) Wouters');
    const toggle = screen.getByRole('button', { name: 'Bestuur en lokale woordvoerders' });
    fireEvent.click(toggle);
    for (const person of people) expect(screen.getByText(person.name)).toBeTruthy();
  });
});