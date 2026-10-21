import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { DeadlineJob } from './outlookDeadlines';
import { runDeadlineDispatch } from './outlookDeadlineDispatch';
import { deadlineSchedulerReady, type DeadlineSchedulerStatus } from './outlookDeadlineReadiness';
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
 const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 const scheduler = await (supabaseAdmin as any).rpc('outlook_deadline_scheduler_status');
 return { scheduler: scheduler.error ? null : scheduler.data as DeadlineSchedulerStatus, internalConfigured: !!process.env['INTERNAL_WEBHOOK_SECRET'], enabled: settings.data?.enabled ?? false, releaseReady: process.env['OUTLOOK_DEADLINES_RELEASED'] === 'true', mappings: mappings.data?.length ?? 0, rows: (queue.data ?? []) as { task_id: string; state: string; last_error: string | null; updated_at: string }[] };
});
export async function configureDeadlineHandler({ data, context }: { data: { enabled: boolean; confirm: true }; context: Context }) {
 const c = context as Context; await assertDeadlineAdmin(c);
 if (data.enabled && process.env['OUTLOOK_DEADLINES_RELEASED'] !== 'true') throw new Error('Activatie geblokkeerd tot veilige koppeling en release zijn gereviewd.');
 const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 if (data.enabled) {
 const scheduler = await (supabaseAdmin as any).rpc('outlook_deadline_scheduler_status');
 if (scheduler.error || !deadlineSchedulerReady(scheduler.data, !!process.env['INTERNAL_WEBHOOK_SECRET'])) throw new Error('Activatie geblokkeerd: deadlineplanning of interne koppeling niet beschikbaar.');
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
 if (!cal.id || !cal.canEdit) throw new Error('Bevestigde agenda niet schrijfbaar.');
 }
 }
 const r = await supabaseAdmin.rpc('outlook_deadline_configure', { _enabled: data.enabled, _actor: c.userId });
 if (r.error) throw new Error(r.error.message);
 return { enabled: data.enabled };
}
export const configureOutlookDeadlines = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator(d => z.object({ enabled: z.boolean(), confirm: z.literal(true) }).parse(d))
 .handler(configureDeadlineHandler);
/** Manual and scheduled dispatch share the same bounded worker and SQL claim. */
export const dispatchOutlookDeadlines = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator(d => z.object({ confirm: z.literal(true) }).parse(d))
 .handler(async ({ context }) => {
 const c = context as Context; await assertDeadlineAdmin(c);
 const g = await import('./plannerGraph.server');
 const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 return runDeadlineDispatch({
 now: Date.now,
 allowed: async () => { await assertDeadlineAdmin(c); if(process.env['OUTLOOK_DEADLINES_RELEASED'] !== 'true' || !g.readGraphConfig(process.env)) return false; const s=await c.supabase.from('outlook_deadline_settings').select('enabled').maybeSingle(); return !s.error && s.data?.enabled === true; },
 claim: async () => { const r=await c.supabase.rpc('outlook_deadline_claim'); if(r.error) throw new Error(r.error.message); return r.data as DeadlineJob | null; },
 valid: async j => {
 const r=await c.supabase.rpc('outlook_deadline_valid',{_task:j.task_id,_lock:j.lock_token,_revision:j.revision});
 if(r.error || r.data !== true) return false;
 if(j.mapped_account && j.task.assignee_id) {
 const role=await c.supabase.rpc('has_role',{_user_id:j.task.assignee_id,_role:'admin'});
 const m=await c.supabase.from('planner_user_map').select('entra_id,confirmed_at,confirmed_by').eq('user_id',j.task.assignee_id).maybeSingle();
 return !role.error && role.data===true && !m.error && !!m.data?.confirmed_at && !!m.data?.confirmed_by && m.data.entra_id===j.mapped_account;
 } return true;
 },
 graph: async () => { const cfg=g.readGraphConfig(process.env); if(!cfg) throw new Error('Microsoft-koppeling ontbreekt'); const {token,roles}=await g.getAppToken(cfg); if(!roles.includes('Calendars.ReadWrite')) throw new Error('Calendars.ReadWrite ontbreekt'); const {deadlineGraph}=await import('./outlookDeadlineGraph.server'); return deadlineGraph(token); },
 finish: async(j,result) => { const r=await supabaseAdmin.rpc('outlook_deadline_finish',{_task:j.task_id,_lock:j.lock_token,_result:JSON.parse(JSON.stringify(result)),_actor:c.userId}); if(r.error) throw new Error('Uitkomst kon niet worden opgeslagen; geen automatische heraanmaak.'); },
 });
 });
