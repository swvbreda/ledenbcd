import {describe,it,expect} from 'vitest';
import {importRevisionSchema,minutesStatus,prepareMinutesPackage,sha256} from '../boardMinutesImport';
const bytes=new TextEncoder().encode('%PDF-1.7 synthetic original');
async function packageFixture(){
 const hash=await sha256(bytes),path=`originals/topical/${hash}.pdf`;
 const record={source_id:'synthetic-1',source_url:'https://example.invalid/1',meeting_date:'2026-04-02',title:'Synthetic board meeting',status:'historisch-onbevestigd',review_required:true,file_name:'Original.pdf',sha256:hash,archive_path:path,full_export_text:'Agenda only, invited persons not attendance',summary_text:'',has_summary:false};
 return {entries:{'manifest.json':new TextEncoder().encode(JSON.stringify({schema_version:1,read_at:'2026-11-09',excluded:[{reason:'ALV'}],onedrive_meetings:[],topical_meetings:[record]})),[path]:bytes},record,path};
}
describe('private archive import rules',()=>{
 it('agenda without summary stays report-missing and preserves source, never actions or attendance',async()=>{const {entries}=await packageFixture();const p=await prepareMinutesPackage(entries);expect(p.meetings).toBe(1);expect(p.excluded).toBe(1);expect(p.originals[0]?.revision.input.report).toBe('');expect(p.originals[0]?.revision.sourceText).toContain('Agenda');expect(p.originals[0]?.revision.details.attendance).toBeUndefined();expect(p.originals[0]?.revision.input.actions).toEqual([]);expect(minutesStatus(false,p.originals[0]?.revision.details)).toBe('Verslag ontbreekt');});
 it('original hash mismatch stops the package before any writes',async()=>{const {entries,path}=await packageFixture();entries[path]=new TextEncoder().encode('%PDF-changed');await expect(prepareMinutesPackage(entries)).rejects.toThrow('hash');});
 it('historical status is never automatically adopted',()=>{expect(minutesStatus(false,{status:'historisch-onbevestigd',reviewRequired:true,reportMissing:false,meetingType:'bestuursvergadering',originalName:'x.pdf',sourcePaths:[],dateBasis:'filename',versionLabel:''})).toBe('Historisch – status te controleren');expect(minutesStatus(false)).toBe('Concept');});
 it('requires review and denies agenda presented as report',async()=>{const {entries}=await packageFixture();const p=await prepareMinutesPackage(entries);const r=p.originals[0]?.revision;expect(importRevisionSchema.safeParse({...r,details:{...r?.details,reviewRequired:false}}).success).toBe(false);expect(importRevisionSchema.safeParse({...r,input:{...r?.input,report:'Agenda'}}).success).toBe(false);});
});