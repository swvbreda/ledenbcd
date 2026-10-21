import { it, expect } from 'vitest';
import postgres from 'postgres';
import { processDeadline, type DeadlineJob, type DeadlineGraph } from '../outlookDeadlines';
// Explicit opt-in isolated fixture only; no environment-provided production database URL.
it.skipIf(process.env['OUTLOOK_FIXTURE_TEST'] !== 'true')('real claim -> mock Graph -> service finish -> local completion -> own event removal',async()=>{
 const db=postgres({host:'/tmp/outlook-deadlines/socket',port:55441,user:'fixture',database:'exact_schema'});
 try {
 const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',t='dddddddd-dddd-dddd-dddd-dddddddddddd',m='cccccccc-cccc-cccc-cccc-cccccccccccc';
 await db`update outlook_deadline_outbox set state='pending',lock_token=null,lock_until=null`;
 await db`insert into planner_user_map values(${a},${m},${a},now())`;
 let count=0,removes=0;let transaction='';
 const graph:DeadlineGraph={calendar:async()=>({id:'cal',canEdit:true}),get:async()=>({id:'event',etag:'v1',transactionId:transaction}),create:async(_a,_c,b)=>{count++;transaction=b.transactionId;return {id:'event',etag:'v1',transactionId:transaction};},patch:async()=>{throw new Error('unexpected patch')},remove:async()=>{removes++;}};
 async function step(){
 return db.begin(async tx=>{
 await tx`select set_config('request.jwt.claim.sub',${a},true)`;await tx`set local role authenticated`;
 const [row]=await tx`select outlook_deadline_claim() j`;const j=row.j as DeadlineJob;
 const result=await processDeadline(j,graph,async()=>{const [r]=await tx`select outlook_deadline_valid(${t},${j.lock_token},${j.revision}) ok`;return r.ok;});
 await tx`reset role`;await tx`set local role service_role`;
 await tx`select outlook_deadline_finish(${t},${j.lock_token},${tx.json(JSON.parse(JSON.stringify(result)))},${a})`;
 return result;
 });}
 expect((await step()).state).toBe('synced');expect(count).toBe(1);
 await db`update internal_tasks set status='afgerond' where id=${t}`;
 expect((await step()).state).toBe('removed');expect(removes).toBe(1);expect(count).toBe(1);
 const [r]=await db`select event_id,state from outlook_deadline_outbox where task_id=${t}`;expect(r.event_id).toBeNull();expect(r.state).toBe('removed');
 }finally{await db.end();}
});
