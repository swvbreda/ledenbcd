import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import type { Member } from '@/data/types';
import { memberDossierRedirect, resolveSignupDossier } from '@/lib/memberDossierIdentity';
import { useMergedMember } from '@/hooks/useMemberEdits';

const state = vi.hoisted(() => ({ rows: [] as Member[], edits: [] as Array<{member_id: number; data: Partial<Member>}>, loading: false }));
vi.mock('@/contexts/MembersDataContext', () => ({ useMembersData: () => ({ allMembersAndLeads: state.rows, rawOldMembers: [], rawLeads: [], isLoading: state.loading }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-fixture' }, isAdmin: true }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: async () => ({ data: state.edits, error: null }) }) } }));
vi.mock('@/lib/contactRemoval.functions', () => ({ removeMemberContacts: vi.fn() }));
vi.mock('@/lib/contactInvites', () => ({ newContactEmails: vi.fn(), sendContactInvites: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));

const goa = { id: 150, naam: 'GOA', plaats: 'Leiden', locaties: [], contacten: [] } as unknown as Member;
const scolo = { id: 32, naam: 'Coffeeshop Scolo', plaats: 'IJmuiden', locaties: [], contacten: [] } as unknown as Member;
const otherGoa = { ...goa, id: 88, plaats: 'Amsterdam' };
const history = [{ lead_id: 150, lidnummer: 32 }];
const signup = { coffeeshop_name: 'GOA', city: 'Leiden', matched_member_id: 150, match_status: 'created' };
afterEach(() => { cleanup(); state.loading = false; state.edits = []; });

describe('current canonical ID versus conversion history', () => {
  it('reproduces the old wrong target but never redirects current GOA 150 to Scolo 32', () => {
    expect(history.find(c => c.lead_id === 150)?.lidnummer).toBe(32);
    expect(memberDossierRedirect(150, [32, 150], history)).toBeUndefined();
  });
  it('keeps Scolo 32 and GOA Amsterdam 88 distinct', () => {
    expect(memberDossierRedirect(32, [32, 88, 150], history)).toBeUndefined();
    expect(memberDossierRedirect(88, [32, 88, 150], history)).toBeUndefined();
  });
  it('retains a legacy redirect only when the old row is absent', () => {
    expect(memberDossierRedirect(150, [32], history)).toBe(32);
  });
  it('fails closed for a missing or ambiguous conversion target', () => {
    expect(memberDossierRedirect(150, [], history)).toBeUndefined();
    expect(memberDossierRedirect(150, [32, 88], [...history, {lead_id:150,lidnummer:88}])).toBeUndefined();
    expect(memberDossierRedirect(NaN, [32], history)).toBeUndefined();
  });
});
describe('approval dossier navigation', () => {
  it('uses recorded ID 150 regardless of order, instead of the first GOA by name', () => {
    for (const rows of [[otherGoa, scolo, goa], [goa, scolo, otherGoa]]) {
      expect(resolveSignupDossier(signup, rows).member?.id).toBe(150);
    }
  });
  it('never substitutes another dossier for a missing recorded ID', () => {
    expect(resolveSignupDossier(signup, [otherGoa, scolo])).toEqual({blocked:true});
  });
  it('blocks a recorded ID with conflicting shop/city', () => {
    expect(resolveSignupDossier({...signup, matched_member_id:32}, [scolo,goa])).toEqual({blocked:true});
    expect(resolveSignupDossier({...signup, matched_member_id:88}, [otherGoa,goa])).toEqual({blocked:true});
  });
  it('requires city and uniqueness for a legacy request without ID', () => {
    expect(resolveSignupDossier({...signup,matched_member_id:null},[otherGoa,goa]).member?.id).toBe(150);
    expect(resolveSignupDossier({...signup,matched_member_id:null},[goa,{...goa,id:151}])).toEqual({blocked:true});
    expect(resolveSignupDossier({...signup,matched_member_id:null,city:''},[goa]).member).toBeUndefined();
  });
});
describe('real merged dossier hook with cached edits and changing IDs', () => {
  function wrapper({children}:PropsWithChildren) {
    return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>;
  }
  it('reads 150 then 32 then 150 without cache crossover; overlay cannot overwrite canonical ID', async () => {
    state.rows = [scolo,goa];
    state.edits = [{member_id:150,data:{id:32,contactpersoon:'Pascal hoogewoonink'}},{member_id:32,data:{contactpersoon:'Kelvin Leenders'}}];
    const {result,rerender}=renderHook(({id})=>useMergedMember(id),{initialProps:{id:150},wrapper});
    await waitFor(()=>expect(result.current.isLoading).toBe(false));
    expect(result.current.member?.id).toBe(150);
    expect(result.current.member?.naam).toBe('GOA');
    expect(result.current.member?.contactpersoon).toBe('Pascal hoogewoonink');
    rerender({id:32});
    expect(result.current.member?.id).toBe(32);
    expect(result.current.member?.contactpersoon).toBe('Kelvin Leenders');
    rerender({id:150});
    expect(result.current.member?.id).toBe(150);
    expect(result.current.member?.contactpersoon).toBe('Pascal hoogewoonink');
    rerender({id:999});
    expect(result.current.member).toBeUndefined();
  });
  it('never fabricates a missing row from historical conversions', async () => {
    state.rows = [goa];
    const {result}=renderHook(()=>useMergedMember(32),{wrapper});
    await waitFor(()=>expect(result.current.isLoading).toBe(false));
    expect(result.current.member).toBeUndefined();
  });
  it('waits for current member data before treating a dossier as missing', () => {
    state.rows = [];state.loading=true;
    const {result}=renderHook(()=>useMergedMember(150),{wrapper});
    expect(result.current.isLoading).toBe(true);
    expect(result.current.member).toBeUndefined();
  });
});