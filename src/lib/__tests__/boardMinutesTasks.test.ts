import { describe,it,expect } from 'vitest';
import { explicitOwnerParts,exactDeadline,minuteActionRowsSchema } from '../boardMinutesTasks';
describe('minutes task rules',()=>{
 it('keeps Simone separate from the unassigned collective',()=>expect(explicitOwnerParts('Simone + betrokken bestuursleden')).toEqual(['Simone','betrokken bestuursleden']));
 it('supports multiple explicit people without choosing from Bestuur',()=>{expect(explicitOwnerParts('Huub en Joachim')).toEqual(['Huub','Joachim']);expect(explicitOwnerParts('Bestuur')).toEqual(['Bestuur']);});
 it('accepts only literal real dates, never inferred deadlines',()=>{expect(exactDeadline('2026-12-01')).toBe('2026-12-01');expect(exactDeadline('2026-02-30')).toBeNull();expect(exactDeadline('Volgende vergadering')).toBeNull();});
 it('rejects repeated action ids',()=>{const r={action_id:'00000000-0000-0000-0000-000000000001',action:'Task',owner:'Simone',deadline:''};expect(minuteActionRowsSchema.safeParse([r,r]).success).toBe(false);});
 it('preserves a stable id when the action title changes',()=>{const r={action_id:'00000000-0000-0000-0000-000000000001',action:'Renamed task',owner:'',deadline:''};expect(minuteActionRowsSchema.parse([r])[0]?.action_id).toBe(r.action_id);});
});