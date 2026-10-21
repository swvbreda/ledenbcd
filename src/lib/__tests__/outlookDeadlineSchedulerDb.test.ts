import { it,expect,vi,afterEach } from 'vitest';
import postgres from 'postgres';
import { runDeadlineDispatch } from '../outlookDeadlineDispatch';
import type { DeadlineGraph,DeadlineJob } from '../outlookDeadlines';
const mocks=vi.hoisted(()=>({db:null as any,graph:null as any}));
vi.mock('@/integrations/supabase/client.server',()=>({get supabaseAdmin(){return mocks.db;}}));
vi.mock('../plannerGraph.server',()=>({readGraphConfig:(env:any)=>env.MS_GRAPH_CLIENT_SECRET?{}:null,getAppToken:async()=>({token:'fixture',roles:['Calendars.ReadWrite','Tasks.ReadWrite.All']})}));
vi.mock('../outlookDeadlineGraph.server',()=>({deadlineGraph:()=>mocks.graph}));
import { deadlineSchedulePost } from '@/routes/api/public/outlook-deadline-dispatch';
afterEach(()=>vi.unstubAllEnvs());
it.skipIf(process.env['OUTLOOK_FIXTURE_TEST']!=='true')('real POST route and original SQL claim compete with manual worker, exactly one Graph create',async()=>{
 const db=postgres({host:'/tmp/outlook-deadlines/socket',port:55441,user:'fixture',database:'scheduler_fixture'});
 const actor='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';const t='dddddddd-dddd-dddd-dddd-dddddddddddd';
 try{
 await db`insert into user_roles values(${actor},'admin')`;
 await db`select outlook_deadline_configure(true,${actor})`;
 await db`update outlook_deadline_settings set scheduler_armed=true`;
 await db`insert into planner_user_map values(${actor},'cccccccc-cccc-cccc-cccc-cccccccccccc',${actor},now())`;
 await db`insert into internal_tasks values(${t},'Fixture','2026-10-25',${actor},'te_doen',null)`;
 mocks.db={rpc:async(name:string,args:any={})=>{
 try{
 let data:any;
 if(name==='outlook_deadline_scheduler_actor') [ {v:data} ]=await db`select outlook_deadline_scheduler_actor() v`;
 else if(name==='outlook_deadline_scheduler_claim') [ {v:data} ]=await db`select outlook_deadline_scheduler_claim() v`;
 else if(name==='outlook_deadline_scheduler_valid') [ {v:data} ]=await db`select outlook_deadline_scheduler_valid(${args._task},${args._lock},${args._revision}) v`;
 else if(name==='has_role') [ {v:data} ]=await db`select has_role(${args._user_id},'admin') v`;
 else if(name==='outlook_deadline_finish') await db`select outlook_deadline_finish(${args._task},${args._lock},${db.json(args._result)},${args._actor})`;
 else throw new Error('unexpected RPC');
 return {data,error:null};
 }catch(e){return {data:null,error:e};}},
 from:()=>({select:()=>({eq:(_k:string,id:string)=>({maybeSingle:async()=>({data:(await db`select * from planner_user_map where user_id=${id}`)[0],error:null})})})})};
 let creates=0;
 const graph:DeadlineGraph={calendar:async()=>({id:'cal',canEdit:true}),create:async(_a,_c,b)=>{creates++;await new Promise(r=>setTimeout(r,30));return {id:'event',etag:'v1',transactionId:b.transactionId};},get:async()=>{throw new Error('unexpected GET');},patch:async()=>{throw new Error('unexpected PATCH');},remove:async()=>{throw new Error('unexpected DELETE');}};
 mocks.graph=graph;
 vi.stubEnv('INTERNAL_WEBHOOK_SECRET','isolated-fixture');vi.stubEnv('OUTLOOK_DEADLINES_RELEASED','true');vi.stubEnv('MS_GRAPH_CLIENT_SECRET','isolated-fixture');
 const post=()=>deadlineSchedulePost({request:new Request('https://fixture/api/public/outlook-deadline-dispatch',{method:'POST',headers:{'x-internal-secret':'isolated-fixture'},body:JSON.stringify({actor:'attacker'})})});
 const manual={now:Date.now,allowed:async()=>true,claim:async()=>db.begin(async tx=>{await tx`select set_config('request.jwt.claim.sub',${actor},true)`;await tx`set local role authenticated`;const [r]=await tx`select outlook_deadline_claim() v`;return r.v as DeadlineJob|null;}),valid:async()=>true,graph:async()=>graph,finish:async(j:DeadlineJob,r:any)=>{await db`select outlook_deadline_finish(${j.task_id},${j.lock_token},${db.json(r)},${actor})`;}};
 const [response]=await Promise.all([post(),runDeadlineDispatch(manual)]);
 expect(response.status).toBe(200);expect(creates).toBe(1);
 expect((await db`select state,event_id from outlook_deadline_outbox where task_id=${t}`)[0]).toEqual({state:'synced',event_id:'event'});
 await post();expect(creates).toBe(1);
 // Actual route gates never mutate even with the fixture queue present.
 await db`update outlook_deadline_outbox set state='pending' where task_id=${t}`;
 const denied=await deadlineSchedulePost({request:new Request('https://fixture',{method:'POST',headers:{'x-internal-secret':'wrong'}})});expect(denied.status).toBe(401);
 vi.stubEnv('OUTLOOK_DEADLINES_RELEASED','false');await post();vi.stubEnv('OUTLOOK_DEADLINES_RELEASED','true');
 vi.stubEnv('MS_GRAPH_CLIENT_SECRET','');await post();vi.stubEnv('MS_GRAPH_CLIENT_SECRET','isolated-fixture');
 await db`delete from user_roles where user_id=${actor}`;await post();
 await db`insert into user_roles values(${actor},'admin')`;await db`update outlook_deadline_settings set enabled=false`;await post();
 await db`update outlook_deadline_settings set enabled=true,scheduler_armed=false`;await post();
 expect(creates).toBe(1);expect((await db`select state from outlook_deadline_outbox where task_id=${t}`)[0].state).toBe('pending');
 }finally{
 // Only named isolated fixture. Nothing here can select a production host.
 await db`delete from outlook_deadline_outbox where task_id=${t}`;await db`delete from internal_tasks where id=${t}`;await db`delete from planner_user_map where user_id=${actor}`;await db`delete from user_roles where user_id=${actor}`;await db`delete from outlook_deadline_settings where id`;await db`update cron.job set active=false`;await db.end();
 }
});
