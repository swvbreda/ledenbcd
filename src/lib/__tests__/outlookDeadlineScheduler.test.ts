import { describe,it,expect,vi } from 'vitest';
import { handleDeadlineSchedule } from '../outlookDeadlineScheduler.server';
import { runDeadlineDispatch, type DeadlineDispatchPort } from '../outlookDeadlineDispatch';
import { deadlineGraph } from '../outlookDeadlineGraph.server';
import type { DeadlineJob } from '../outlookDeadlines';
const env={INTERNAL_WEBHOOK_SECRET:'fixture-only',OUTLOOK_DEADLINES_RELEASED:'true',MS_GRAPH_TENANT_ID:'fixture',MS_GRAPH_CLIENT_ID:'fixture',MS_GRAPH_CLIENT_SECRET:'fixture'};
const request=(secret='fixture-only')=>new Request('https://fixture/api/public/outlook-deadline-dispatch',{method:'POST',headers:{'x-internal-secret':secret},body:JSON.stringify({actor:'attacker'})});
const job:DeadlineJob={task_id:'dddddddd-dddd-dddd-dddd-dddddddddddd',revision:1,state:'inflight',event_id:null,account_id:null,calendar_id:null,etag:null,transaction_id:'ffffffff-ffff-ffff-ffff-ffffffffffff',lock_token:'lease',mapped_account:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',task:{id:'dddddddd-dddd-dddd-dddd-dddddddddddd',title:'Fixture',deadline:'2026-10-25',assignee_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',project_id:null,status:'te_doen',archived:false}};
function fixture(allowed=true,queued=true) {
 const f=vi.fn(async (_url:any,init:any)=>new Response(JSON.stringify(init.method==='POST'?{id:'event','@odata.etag':'v1',transactionId:job.transaction_id}:{id:'cal',canEdit:true})));
 const claim=vi.fn(async()=>{if(!queued)return null;queued=false;return structuredClone(job);});
 const port:DeadlineDispatchPort={allowed:async()=>allowed,claim,valid:async()=>true,finish:vi.fn(async()=>{}),graph:vi.fn(async()=>deadlineGraph('fixture-token',f as typeof fetch)),now:()=>0};
 return {port,f,claim};
}
describe('internal scheduled dispatcher',()=>{
 it.each(['wrong',''])('rejects wrong/missing auth without privileged load or POST',async s=>{const x=fixture();const load=vi.fn(async()=>x.port);expect((await handleDeadlineSchedule(request(s),env,load)).status).toBe(401);expect(load).not.toHaveBeenCalled();expect(x.f).not.toHaveBeenCalled();});
 it('POST only',async()=>{expect((await handleDeadlineSchedule(new Request('https://fixture'),env,async()=>fixture().port)).status).toBe(405);});
 it.each(['release','config'])('%s off means no dependency/network',async mode=>{const x=fixture();const load=vi.fn(async()=>x.port);await handleDeadlineSchedule(request(),{...env,...(mode==='release'?{OUTLOOK_DEADLINES_RELEASED:'false'}:{MS_GRAPH_CLIENT_SECRET:undefined})},load);expect(load).not.toHaveBeenCalled();expect(x.f).not.toHaveBeenCalled();});
 it.each(['no-admin','disabled','unarmed'])('%s fails closed no claim/POST',async()=>{const x=fixture(false);await handleDeadlineSchedule(request(),env,async()=>x.port);expect(x.claim).not.toHaveBeenCalled();expect(x.f).not.toHaveBeenCalled();});
 it('empty queue never obtains token or POSTs',async()=>{const x=fixture(true,false);await handleDeadlineSchedule(request(),env,async()=>x.port);expect(x.port.graph).not.toHaveBeenCalled();expect(x.f).not.toHaveBeenCalled();});
 it('enabled confirmed fixture uses original engine exactly once',async()=>{const x=fixture();const r=await handleDeadlineSchedule(request(),env,async()=>x.port);expect(await r.json()).toEqual({processed:1});expect(x.f.mock.calls.filter(c=>c[1].method==='POST')).toHaveLength(1);expect(x.port.finish).toHaveBeenCalledWith(job,expect.objectContaining({state:'synced',event_id:'event'}));});
 it('concurrent scheduler and manual worker share claim, one create',async()=>{const x=fixture();await Promise.all([handleDeadlineSchedule(request(),env,async()=>x.port),runDeadlineDispatch(x.port)]);expect(x.f.mock.calls.filter(c=>c[1].method==='POST')).toHaveLength(1);});
 it('hard cap 10 claims',async()=>{const x=fixture();x.port.claim=vi.fn(async()=>structuredClone(job));expect((await runDeadlineDispatch(x.port)).processed).toBe(10);expect(x.port.claim).toHaveBeenCalledTimes(10);});
 it('time budget never claims after 2 minutes',async()=>{const x=fixture();let calls=0;x.port.now=()=>calls++===0?0:120000;await runDeadlineDispatch(x.port);expect(x.claim).not.toHaveBeenCalled();});
});
