import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemberReconfirmationCampaign } from '../MemberReconfirmationCampaign';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), load: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('@/lib/memberReconfirmationCampaign.functions', () => ({ getMemberReconfirmationCampaign: mocks.load }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function mount(status = 'unsent') {
  mocks.load.mockResolvedValue([{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', member_id: 10, invoice_number: '2026019', shop: 'Fixture shop', name: 'Fixture contact', email: 'fixture@example.invalid', status, blocked: false, sent_at: null, deadline: '', confirmed_at: null }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemberReconfirmationCampaign /></QueryClientProvider>);
}
describe('campaign individual sending controls', () => {
  it('loading and previewing never invokes sender; explicit confirmation sends one request only', async () => {
    mount();
    await screen.findByText('Fixture contact · fixture@example.invalid');
    expect(mocks.invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mail bekijken en verzenden' }));
    expect(mocks.invoke).not.toHaveBeenCalled();
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Deze ene mail verzenden' }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    expect(mocks.invoke).toHaveBeenCalledWith('send-transactional-email', { body: { templateName: 'membership-reconfirmation', requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } });
  });
  it.each(['sending','sent','unknown','suppressed','failed','confirmed'])('does not permit another send for %s', async status => {
    mount(status); await screen.findByText('Fixture contact · fixture@example.invalid');
    const button = screen.getByRole('button', { name: 'Mail bekijken en verzenden' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(mocks.invoke).not.toHaveBeenCalled();
  });
});