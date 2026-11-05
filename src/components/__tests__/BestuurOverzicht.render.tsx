import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, afterEach } from 'vitest';
import BestuurOverzicht from '../BestuurOverzicht';
const mocks = vi.hoisted(() => ({ load: vi.fn(), rpc: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/localSpokespeople.functions', () => ({ getLocalSpokespeople: mocks.load }));
vi.mock('@/lib/router-compat', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, storage: { from: () => ({ list: async () => ({ data: [] }) }) } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function mount() {
  mocks.rpc.mockResolvedValue({ data: [
    { id: 'national', naam: 'Joachim Helms', functie: 'Bestuurder / Woordvoerder', type: 'bestuurslid' },
    { id: 'local', naam: 'Hannes Poppinghaus', functie: 'Woordvoerder Arnhem', type: 'aspirant' },
  ] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}><BestuurOverzicht members={[]} /></QueryClientProvider>);
}
describe('department read integration', () => {
  it('reads the source separately without changing board records', async () => {
    mocks.load.mockResolvedValue({ people: [{ name: 'Dhr. M. (Michel) Wouters', department: 'Rotterdam', email: 'Rotterdam@coffeeshopbond.nl' }], source: 'https://www.coffeeshopbond.nl/over-ons' });
    mount();
    await screen.findByText('Dhr. M. (Michel) Wouters');
    expect(mocks.rpc).toHaveBeenCalledWith('get_board_members_public');
    expect(mocks.load).toHaveBeenCalled();
    expect(screen.queryByText('Aspirant')).toBeNull();
  });
  it('retains known representatives on source failure and exposes the failure', async () => {
    mocks.load.mockRejectedValue(new Error('offline')); mount();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Woordvoerders opnieuw laden' })).toBeTruthy());
    expect(screen.getByText('Hannes Poppinghaus')).toBeTruthy();
    expect(screen.queryByText('Dhr. M. (Michel) Wouters')).toBeNull();
  });
});