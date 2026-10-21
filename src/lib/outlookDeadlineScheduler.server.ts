import { timingSafeEqual } from 'node:crypto';
import { runDeadlineDispatch, type DeadlineDispatchPort } from './outlookDeadlineDispatch';
import type { DeadlineJob } from './outlookDeadlines';
import { readGraphConfig, getAppToken } from './plannerGraph.server';
import { deadlineGraph } from './outlookDeadlineGraph.server';
// Internal caller is authenticated before loading any privileged dependency.
export async function handleDeadlineSchedule(request: Request, env: Record<string, string | undefined>, load: () => Promise<DeadlineDispatchPort>) {
 if (request.method !== 'POST') return new Response(null, { status: 405 });
 const secret = env['INTERNAL_WEBHOOK_SECRET']; const provided = request.headers.get('x-internal-secret');
 if (!secret || !provided || Buffer.byteLength(secret) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))) return new Response(null, { status: 401 });
 if (env['OUTLOOK_DEADLINES_RELEASED'] !== 'true') return Response.json({ processed: 0, status: 'release_off' });
 if (!readGraphConfig(env)) return Response.json({ processed: 0, status: 'config_missing' });
 try { return Response.json(await runDeadlineDispatch(await load())); }
 catch { return Response.json({ status: 'unavailable' }, { status: 503 }); }
}
export async function scheduledDeadlinePort(env: Record<string,string|undefined>): Promise<DeadlineDispatchPort> {
 const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
 let actor: string | null = null;
 async function rpc(name: string, args?: Record<string,unknown>): Promise<any> {
 const { data, error } = await (db as any).rpc(name,args); if (error) throw new Error('Deadlineverwerking niet beschikbaar'); return data;
 }
 return {
 now: Date.now,
 allowed: async () => {
 if (env['OUTLOOK_DEADLINES_RELEASED'] !== 'true' || !readGraphConfig(env)) return false;
 const a = await rpc('outlook_deadline_scheduler_actor');
 if (!a || (actor && actor !== a)) return false;
 actor = a; return true;
 },
 claim: () => rpc('outlook_deadline_scheduler_claim'),
 valid: async (j: DeadlineJob) => {
 const ok = await rpc('outlook_deadline_scheduler_valid',{_task:j.task_id,_lock:j.lock_token,_revision:j.revision});
 if (ok !== true) return false;
 if (j.mapped_account && j.task.assignee_id) {
 const role = await rpc('has_role',{_user_id:j.task.assignee_id,_role:'admin'});
 const m = await db.from('planner_user_map').select('entra_id,confirmed_at,confirmed_by').eq('user_id',j.task.assignee_id).maybeSingle();
 return role === true && !m.error && !!m.data?.confirmed_at && !!m.data?.confirmed_by && m.data.entra_id === j.mapped_account;
 }
 return true;
 },
 finish: async (j,r) => { if (!actor) throw new Error('Geen beheerder'); await rpc('outlook_deadline_finish',{_task:j.task_id,_lock:j.lock_token,_result:JSON.parse(JSON.stringify(r)),_actor:actor}); },
 graph: async () => { const cfg=readGraphConfig(env); if(!cfg) throw new Error('Geen configuratie'); const {token,roles}=await getAppToken(cfg); if(!roles.includes('Calendars.ReadWrite')) throw new Error('Geen agendarecht'); return deadlineGraph(token); },
 };
}
