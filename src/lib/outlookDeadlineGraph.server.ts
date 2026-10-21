import { assertGraphUrl } from './plannerGraph.server';
import { DeadlineGraphError, type DeadlineGraph, type DeadlineEvent } from './outlookDeadlines';
/** Reuses existing Graph origin/config; no retries of writes, no mailbox fallbacks. */
export function deadlineGraph(token: string, f: typeof fetch = fetch): DeadlineGraph {
 const path = (account: string, calendar?: string, event?: string) => {
 if (!/^[0-9a-f-]{36}$/i.test(account)) throw new Error('Ongeldig bevestigd account');
 return `/users/${account}/${calendar ? `calendars/${encodeURIComponent(calendar)}/events${event ? `/${encodeURIComponent(event)}` : ''}` : 'calendar'}`;
 };
 async function req(method: string, p: string, body?: unknown, etag?: string) {
 let response: Response;
 try { response = await f(assertGraphUrl(p), {
 method, headers: { Authorization: `Bearer ${token}`, Prefer: 'IdType="ImmutableId", outlook.timezone="Europe/Amsterdam"',
 ...(body ? { 'Content-Type': 'application/json' } : {}), ...(etag ? { 'If-Match': etag } : {}) },
 ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
 }); } catch { throw new DeadlineGraphError(0, method !== 'GET'); }
 if (!response.ok) throw new DeadlineGraphError(response.status, method !== 'GET' && response.status >= 500);
 try { const text = await response.text(); const json = text ? JSON.parse(text) : {};
 return { ...json, etag: json['@odata.etag'] ?? response.headers.get('ETag') ?? '' }; }
 catch { throw new DeadlineGraphError(response.status, method !== 'GET'); }
 }
 return {
 calendar: a => req('GET', path(a) + '?$select=id,canEdit'),
 get: (a,c,id) => req('GET', path(a,c,id)),
 create: (a,c,b) => req('POST',path(a,c),b) as Promise<DeadlineEvent>,
 patch: (a,c,id,e,b) => { const { transactionId: _transaction, ...update } = b; return req('PATCH',path(a,c,id),update,e); },
 remove: async (a,c,id,e) => { await req('DELETE',path(a,c,id),undefined,e); },
 };
}
