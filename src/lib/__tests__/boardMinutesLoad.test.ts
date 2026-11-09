import {describe,it,expect,vi} from 'vitest';
import {readMinutesArchive,minutesPageSize,boundedMinutesRead,type MinutesReadRow} from '../boardMinutesLoad';
describe('archive read completion',()=>{
 it('returns all 182 meetings, 293 versions and 416 attachment rows through small pages',async()=>{
  const sizes={meetings:182,versions:293,files:416,adoptions:0,imports:293};
  const calls: number[]=[];
  const result=await readMinutesArchive(async(table,offset)=>{const count=Math.max(0,Math.min(minutesPageSize(table),sizes[table]-offset));calls.push(count);return {canManage:true,rows:Array.from({length:count},(_,i)=>({id:`${table}-${offset+i}`,source:'topical',source_id:'synthetic',created_at:'',created_by:''})) as MinutesReadRow[]};});
  expect(result.meetings).toHaveLength(182);expect(result.versions).toHaveLength(293);expect(result.files).toHaveLength(416);expect(result.imports).toHaveLength(293);expect(Math.max(...calls)).toBe(100);expect(result.canManage).toBe(true);
 });
 it('rejects failed page rather than publishing partial archive',async()=>{await expect(readMinutesArchive(async(table)=>{if(table==='imports')throw new Error('denied');return {canManage:false,rows:[]};})).rejects.toThrow('denied');});
 it('hung reads become retryable errors instead of infinite loading',async()=>{vi.useFakeTimers();try{const pending=boundedMinutesRead(()=>new Promise(()=>{}),20);const check=expect(pending).rejects.toThrow('duurt te lang');await vi.advanceTimersByTimeAsync(21);await check;}finally{vi.useRealTimers();}});
});