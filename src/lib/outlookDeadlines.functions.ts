import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { processDeadline, type DeadlineJob } from './outlookDeadlines';
type Context = { supabase: any; userId: string };
export async function assertDeadlineAdmin(c: Context) {
 const { data, error } = await c.supabase.rpc('has_role', { _user_id: c.userId, _role: 'admin' });
 if (error || data !== true) throw new Error('Alleen beheerders hebben toegang.');
}
export const outlookDeadlineStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
 const c = context as Context; await assertDeadlineAdmin(c);
 const settings = await c.supabase.from('outlook_deadline_settings').select('enabled').maybeSingle();
 const queue = await c.supabase.from('outlook_deadline_outbox').select('task_id,state,last_error,updated_at').order('updated_at', { ascending: false }).limit(50);
 const mappings = await c.supabase.from('planner_user_map').select('user_id').not('confirmed_by','is',null).not('confirmed_at','is',null);
 if (settings.error || queue.error || mappings.error) throw new Error('Deadline-status niet beschikbaar.');
 return { enabled: settings.data?.enabled ?? false, releaseReady: process.env['OUTLOOK_DEADLINES_RELEASED'] === 'true', mappings: mappings.data?.length ?? 0, rows: (queue.data ?? []) as { task_id: string; state: string; last_error: string | null; updated_at: string }[] };
});
export const configureOutlookDeadlines = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator(d => z.object({ enabled: z.boolean(), confirm: z.literal(true) }).parse(d))
 .handler(async ({ data, context }) => {
 const c = context as Context; await assertDeadlineAdmin(c);
 if (data.enabled && process.env['OUTLOOK_DEADLINES_RELEASED'] !== 'true') throw new Error('Activatie geblokkeerd tot veilige koppeling en release zijn gereviewd.');
 if (data.enabled) {
 const g = await import('./plannerGraph.server'); const cfg = g.readGraphConfig(process.env);
 if (!cfg) throw new Error('Microsoft-koppeling ontbreekt.');
 const { token, roles } = await g.getAppToken(cfg);
 if (!roles.includes('Calendars.ReadWrite')) throw new Error('Calendars.ReadWrite ontbreekt (los van Planner Tasks.ReadWrite.All).');
 const { data: maps, error } = await c.supabase.from('planner_user_map').select('user_id,entra_id').not('confirmed_by','is',null).not('confirmed_at','is',null).limit(20);
 if (error || !maps?.length) throw new Error('Geen bevestigde Microsoft-accounts.');
 const { deadlineGraph } = await import('./outlookDeadlineGraph.server');
 for (const m of maps) {
 const role = await c.supabase.rpc('has_role', { _user_id: m.user_id, _role: 'admin' });
 if (role.error || role.data !== true) throw new Error('Verantwoordelijke is geen actuele beheerder.');
 const cal = await deadlineGraph(token).calendar(m.entra_id);
 if (!cal.canEdit) throw new Error('Bevestigde agenda niet schrijfbaar.');
 }
 }
 const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 const r = await supabaseAdmin.rpc('outlook_deadline_configure', { _enabled: data.enabled, _actor: c.userId });
 if (r.error) throw new Error(r.error.message);
 return { enabled: data.enabled };
 });
/** Bounded explicit dispatcher. No cron or dispatch on task completion/page load. */
export const dispatchOutlookDeadlines = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator(d => z.object({ confirm: z.literal(true) }).parse(d))
 .handler(async ({ context }) => {
 const c = context as Context; await assertDeadlineAdmin(c);
 if (process.env['OUTLOOK_DEADLINES_RELEASED'] !== 'true') throw new Error('Synchronisatie nog niet vrijgegeven.');
 const s = await c.supabase.from('outlook_deadline_settings').select('enabled').maybeSingle();
 if (s.error || !s.data?.enabled) return { processed: 0 };
 const g = await import('./plannerGraph.server'); const cfg = g.readGraphConfig(process.env);
 if (!cfg) throw new Error('Microsoft-koppeling ontbreekt.');
 const { token, roles } = await g.getAppToken(cfg);
 if (!roles.includes('Calendars.ReadWrite')) throw new Error('Calendars.ReadWrite ontbreekt.');
 const { deadlineGraph } = await import('./outlookDeadlineGraph.server');
 const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 let processed = 0;
 // At most 10 jobs and 2 minutes; each Graph call has a 15s timeout, lease lasts 5 minutes.
 const until = Date.now() + 120000;
 while (processed < 10 && Date.now() < until) {
 await assertDeadlineAdmin(c);
 const claim = await c.supabase.rpc('outlook_deadline_claim');
 if (claim.error) throw new Error(claim.error.message);
 if (!claim.data) break;
 const job = claim.data as DeadlineJob;
 const result = await processDeadline(job, deadlineGraph(token), async () => {
 await assertDeadlineAdmin(c);
 if (Date.now() >= until) return false;
 const r = await c.supabase.rpc('outlook_deadline_valid', { _task: job.task_id, _lock: job.lock_token, _revision: job.revision });
 if (r.error || r.data !== true) return false;
 if (job.mapped_account && job.task.assignee_id) {
 const role = await c.supabase.rpc('has_role', { _user_id: job.task.assignee_id, _role: 'admin' });
 const m = await c.supabase.from('planner_user_map').select('entra_id,confirmed_at,confirmed_by').eq('user_id',job.task.assignee_id).maybeSingle();
 if (role.error || role.data !== true || m.error || !m.data?.confirmed_at || !m.data?.confirmed_by || m.data.entra_id !== job.mapped_account) return false;
 }
 return true;
 });
 const saved = await supabaseAdmin.rpc('outlook_deadline_finish', { _task: job.task_id, _lock: job.lock_token, _result: JSON.parse(JSON.stringify(result)), _actor: c.userId });
 if (saved.error) throw new Error('Uitkomst kon niet worden opgeslagen; controleer deadline-status. Geen automatische heraanmaak.');
 processed++;
 }
 return { processed };
 });
