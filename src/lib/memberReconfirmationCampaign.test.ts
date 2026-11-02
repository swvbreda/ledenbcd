import { describe, it, expect, vi } from 'vitest';
import { RECONFIRMATION_MEMBERS, RECONFIRMATION_CAMPAIGN, RECONFIRMATION_FROM, RECONFIRMATION_REPLY_TO, reconfirmationLink, reconfirmationOutcome, reconfirmationDisplayStatus, runReconfirmationSend, ReconfirmationSuppressedError, type ReconfirmationSendDeps } from '../../supabase/functions/_shared/memberReconfirmationPolicy';

function fixture(overrides: Partial<ReconfirmationSendDeps> = {}) {
  return { authorize: vi.fn(async () => 'admin'), claim: vi.fn(async () => ({ claimed: true })), send: vi.fn(async () => ({ ok: true, status: 200, id: 'provider-123' })), finish: vi.fn(async () => {}), ...overrides };
}
describe('individual membership reconfirmation', () => {
  it('limits the approved campaign to exactly the eleven IDs', () => {
    expect(RECONFIRMATION_CAMPAIGN).toBe('contributie-2026-11');
    expect([...RECONFIRMATION_MEMBERS]).toEqual([10,25,34,75,78,79,91,99,107,110,114]);
  });
  it('pins the approved sender and reply destination', () => {
    expect(RECONFIRMATION_FROM).toBe('Bond van Cannabis Detaillisten <noreply@leden.coffeeshopbond.nl>');
    expect(RECONFIRMATION_REPLY_TO).toBe('info@coffeeshopbond.nl');
  });
  it('puts scoped capability only in the portal fragment', () => {
    const url = new URL(reconfirmationLink('a'.repeat(64)));
    expect(url.origin).toBe('https://leden.coffeeshopbond.nl');
    expect(url.pathname).toBe('/lidmaatschap-bevestigen');
    expect(url.search).toBe(''); expect(url.hash).toBe('#token=' + 'a'.repeat(64));
    expect(() => reconfirmationLink('https://evil.example')).toThrow();
  });
  it('denies unauthenticated/non-admin before claim or transport', async () => {
    const deps = fixture({ authorize: vi.fn(async () => { throw new Error('Denied'); }) });
    await expect(runReconfirmationSend(deps)).rejects.toThrow('Denied');
    expect(deps.claim).not.toHaveBeenCalled(); expect(deps.send).not.toHaveBeenCalled();
  });
  it('never sends on duplicate/permanent claim', async () => {
    const deps = fixture({ claim: vi.fn(async () => ({ claimed: false, status: 'unknown' })) });
    expect(await runReconfirmationSend(deps)).toEqual({ success: false, status: 'unknown' });
    expect(deps.send).not.toHaveBeenCalled(); expect(deps.finish).not.toHaveBeenCalled();
  });
  it('preserves suppression without a provider request', async () => {
    const deps = fixture({ claim: vi.fn(async () => ({ claimed: false, status: 'suppressed' })) });
    expect((await runReconfirmationSend(deps)).status).toBe('suppressed'); expect(deps.send).not.toHaveBeenCalled();
  });
  it('records only proven provider acceptance as sent', async () => {
    const deps = fixture(); expect(await runReconfirmationSend(deps)).toEqual({ success: true, status: 'sent' });
    expect(deps.finish).toHaveBeenCalledExactlyOnceWith('sent','provider-123',200);
  });
  it.each([[true,200,undefined,'unknown'],[false,500,null,'unknown'],[false,408,null,'unknown'],[false,429,null,'failed'],[false,422,null,'failed']] as const)('classifies response %s/%s honestly', (ok,status,id,expected) => {
    expect(reconfirmationOutcome(ok,status,id)).toBe(expected);
  });
  it('network timeout never retries, records unknown', async () => {
    const deps = fixture({ send: vi.fn(async () => { throw new Error('timeout'); }) });
    expect((await runReconfirmationSend(deps)).success).toBe(false);
    expect(deps.send).toHaveBeenCalledTimes(1); expect(deps.finish).toHaveBeenCalledExactlyOnceWith('unknown',null,null);
  });
  it('second suppression check is recorded as suppressed', async () => {
    const deps = fixture({ send: vi.fn(async () => { throw new ReconfirmationSuppressedError(); }) });
    expect((await runReconfirmationSend(deps)).status).toBe('suppressed');
  });
  it('finish storage failure is never reported as success', async () => {
    const deps = fixture({ finish: vi.fn(async () => { throw new Error('storage failed'); }) });
    await expect(runReconfirmationSend(deps)).rejects.toThrow('storage failed'); expect(deps.send).toHaveBeenCalledTimes(1);
  });
  it('interrupted send becomes unknown in UI but retains permanent claim', () => {
    expect(reconfirmationDisplayStatus({ send_status: 'sending', send_started_at: '2026-11-02T20:00:00Z' }, Date.parse('2026-11-02T20:03:00Z'))).toBe('unknown');
  });
});