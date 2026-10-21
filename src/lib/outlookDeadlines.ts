/** Pure deadline lifecycle. Internal tasks remain the only source of truth. */
export type DeadlineTask = { id: string; title: string; deadline: string | null; assignee_id: string | null; project_id: string | null; status: string; archived: boolean };
export type DeadlineJob = { task_id: string; revision: number; state: string; event_id: string | null; account_id: string | null; calendar_id: string | null; etag: string | null; transaction_id: string; lock_token: string; mapped_account: string | null; task: DeadlineTask };
export type DeadlineResult = { state: string; error?: string; event_id?: string | null; account_id?: string | null; calendar_id?: string | null; etag?: string | null; applied?: unknown };
export type DeadlineEvent = { id: string; etag: string; transactionId?: string; attendees?: unknown[]; isOnlineMeeting?: boolean; type?: string };
export interface DeadlineGraph {
 calendar(account: string): Promise<{ id: string; canEdit: boolean }>;
 get(account: string, calendar: string, id: string): Promise<DeadlineEvent>;
 create(account: string, calendar: string, body: ReturnType<typeof deadlineBody>): Promise<DeadlineEvent>;
 patch(account: string, calendar: string, id: string, etag: string, body: ReturnType<typeof deadlineBody>): Promise<DeadlineEvent>;
 remove(account: string, calendar: string, id: string, etag: string): Promise<void>;
}
export class DeadlineGraphError extends Error {
 constructor(public status: number, public uncertain: boolean = false) { super(`Microsoft ${status || 'antwoord onbekend'}`); }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function nextDeadlineDay(day: string): string {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Ongeldige deadline');
 const date = new Date(`${day}T00:00:00Z`);
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error('Ongeldige deadline');
 date.setUTCDate(date.getUTCDate() + 1);
 return date.toISOString().slice(0, 10);
}
export function deadlineBody(t: DeadlineTask, transactionId: string) {
 if (!t.deadline || !UUID.test(t.id) || !UUID.test(transactionId) || (t.project_id && !UUID.test(t.project_id))) throw new Error('Ongeldige taak');
 const backlink = new URL('https://leden.coffeeshopbond.nl/projecten');
 if (t.project_id) backlink.searchParams.set('project', t.project_id);
 backlink.searchParams.set('task', t.id);
 return {
 subject: `Taakdeadline — ${t.title}`, isAllDay: true, showAs: 'free', isReminderOn: false,
 start: { dateTime: `${t.deadline}T00:00:00`, timeZone: 'Europe/Amsterdam' },
 end: { dateTime: `${nextDeadlineDay(t.deadline)}T00:00:00`, timeZone: 'Europe/Amsterdam' },
 body: { contentType: 'Text', content: backlink.href }, transactionId,
 };
}
/** One claimed job, never blind retries. Every mutation rechecks lease + task revision. */
export async function processDeadline(job: DeadlineJob, graph: DeadlineGraph, valid: () => Promise<boolean>): Promise<DeadlineResult> {
 if (job.state !== 'inflight') return { state: job.state };
 const t = job.task;
 const eligible = t.status !== 'afgerond' && !t.archived && !!t.deadline && !!t.assignee_id;
 const account = eligible && job.mapped_account && UUID.test(job.mapped_account) ? job.mapped_account : null;
 let writing = false;
 try {
 if (!(await valid())) return { state: 'pending', error: 'Taak gewijzigd of synchronisatie gepauzeerd.' };
 if (job.event_id) {
 if (!job.account_id || !job.calendar_id || !job.etag) return { state: 'conflict', error: 'Bewijs van gekoppeld Outlook-item ontbreekt.' };
 const current = await graph.get(job.account_id, job.calendar_id, job.event_id);
 if (current.id !== job.event_id || current.etag !== job.etag || current.transactionId !== job.transaction_id || current.attendees?.length || current.isOnlineMeeting || (current.type && current.type !== 'singleInstance'))
 return { state: 'conflict', error: 'Outlook-item extern gewijzigd; geen wijzigingen uitgevoerd.' };
 if (!(await valid())) return { state: 'pending' };
 writing = true;
 if (!eligible || account !== job.account_id) {
 await graph.remove(job.account_id, job.calendar_id, job.event_id, job.etag);
 // New owner is created on a separate claim, after confirmed removal of the old event.
 return { state: 'removed', event_id: null, account_id: null, calendar_id: null, etag: null, applied: null };
 }
 const body = deadlineBody(t, job.transaction_id);
 const updated = await graph.patch(job.account_id, job.calendar_id, job.event_id, job.etag, body);
 if (updated.id !== job.event_id || !updated.etag) return { state: 'uncertain', error: 'Bijwerken niet volledig bevestigd.' };
 return { state: 'synced', etag: updated.etag, applied: body };
 }
 if (!eligible) return { state: 'removed' };
 if (!account) return { state: 'blocked', error: 'Verantwoordelijke heeft geen bevestigd actief Microsoft-account.' };
 const calendar = await graph.calendar(account);
 if (!calendar.id || !calendar.canEdit) return { state: 'blocked', error: 'Bevestigde Outlook-agenda is niet schrijfbaar.' };
 const body = deadlineBody(t, job.transaction_id);
 if (!(await valid())) return { state: 'pending' };
 writing = true;
 const created = await graph.create(account, calendar.id, body);
 if (!created.id || !created.etag || created.transactionId !== job.transaction_id) return { state: 'uncertain', error: 'Aanmaak niet volledig bevestigd; controleer Outlook.' };
 return { state: 'synced', event_id: created.id, account_id: account, calendar_id: calendar.id, etag: created.etag, applied: body };
 } catch (e) {
 if (e instanceof DeadlineGraphError) {
 if (e.status === 412 || e.status === 404) return { state: 'conflict', error: 'Outlook-item gewijzigd of ontbreekt; controleer handmatig.' };
 if (e.uncertain || (writing && (!e.status || e.status >= 500))) return { state: 'uncertain', error: 'Uitkomst onbekend; niet automatisch opnieuw aanmaken.' };
 return { state: 'failed', error: e.message };
 }
 return { state: writing ? 'uncertain' : 'failed', error: writing ? 'Uitkomst onbekend; controleer Outlook.' : 'Voorbereiding mislukt; niets gewijzigd.' };
 }
}
