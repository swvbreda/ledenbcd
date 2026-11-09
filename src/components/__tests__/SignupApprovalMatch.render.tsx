import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GoedkeuringenPage from '@/pages/GoedkeuringenPage';

const fixture = vi.hoisted(() => ({ review: false, navigate: vi.fn(), update: vi.fn(), convert: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: true }) }));
vi.mock('@/lib/router-compat', () => ({ useNavigate: () => fixture.navigate }));
vi.mock('@/contexts/MembersDataContext', () => ({ useMembersData: () => ({ rawMembers: [{ id: 150, naam: 'Vriendschap', plaats: 'Leiden' }], rawLeads: [], rawOldMembers: [], isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/useMembershipRequests', () => ({ useMembershipRequests: () => ({ data: [{ id: 'synthetic-signup', coffeeshop_name: 'Coffeeshop De Vriendschap', city: 'Leiden', full_name: 'Synthetic applicant', email: 'synthetic@example.invalid', created_at: '2026-11-09', status: 'new', matched_member_id: fixture.review ? null : 150, match_status: fixture.review ? 'review' : 'matched' }] }), useUpdateMembershipRequest: () => ({ mutateAsync: fixture.update, mutate: fixture.update, isPending: false }) }));
vi.mock('@/hooks/useMemberEdits', () => ({ useEditRequests: () => ({ data: [] }), useApproveEditRequest: () => ({}), useRejectEditRequest: () => ({}) }));
vi.mock('@/hooks/useLeadConversions', () => ({ convertLead: fixture.convert }));
vi.mock('@/lib/memberNumber', () => ({ nextMemberNumber: vi.fn() }));
vi.mock('@/components/register/LogoGoedkeuringPanel', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) }) } }));
afterEach(() => { cleanup(); fixture.review = false; vi.clearAllMocks(); });

it('enables the normalized recorded match, opens its dossier, and shows the existing-member confirmation', async () => {
  render(<GoedkeuringenPage />);
  const approve = screen.getByRole('button', { name: /^Goedkeuren$/ });
  expect(approve.hasAttribute('disabled')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Bekijk lid' }));
  expect(fixture.navigate).toHaveBeenCalledWith('/leden/150');
  fireEvent.click(approve);
  await screen.findByText(/Vriendschap is al lid/);
  expect(fixture.update).not.toHaveBeenCalled();
  expect(fixture.convert).not.toHaveBeenCalled();
});

it('retains the fail-closed block for ambiguous manual review and never performs an approval', () => {
  fixture.review = true;
  render(<GoedkeuringenPage />);
  expect(screen.getByRole('button', { name: /^Goedkeuren$/ }).hasAttribute('disabled')).toBe(true);
  expect(fixture.update).not.toHaveBeenCalled();
});