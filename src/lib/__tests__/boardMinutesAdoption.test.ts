import {describe,it,expect} from 'vitest';
import {historicalAdoptionPlan} from '../boardMinutesAdoption';
import {minutesStatus} from '../boardMinutesImport';
import type {MinutesArchive} from '../boardMinutes';
function fixture(){
 const archive:MinutesArchive={canManage:true,meetings:[],versions:[],files:[],adoptions:[],imports:[]};
 for(const [i,date,kind] of [[1,'2026-04-02','ai-report'],[2,'2026-05-07','brief-notes'],[3,'2026-06-04','agenda-only'],[4,'2026-11-06','summary']] as const){
  const id=String(i);archive.meetings.push({id,source:i===4?'upload':'topical',source_id:id,created_at:'',created_by:''});
  archive.versions.push({id,meeting_id:id,version:2,meeting_date:date,title:'Synthetic',report:kind==='agenda-only'?'':'Synthetic source unchanged',decisions:[],actions:[],source_url:null,content_hash:'',created_at:'',created_by:''});
  archive.versions.push({...archive.versions[archive.versions.length-1],id:`old-${id}`,version:1} as MinutesArchive['versions'][number]);
  archive.files.push({id,version_id:id,path:'synthetic.pdf',original_name:'synthetic.pdf',sha256:'',size_bytes:1,created_at:'',created_by:''});
  archive.imports?.push({version_id:id,source_text:'Synthetic',details:{status:i===4?'concept':'historisch-onbevestigd',reportKind:kind,reviewRequired:true,reportMissing:kind==='agenda-only',meetingType:'bestuursvergadering',originalName:'',sourcePaths:[],dateBasis:'',versionLabel:''}});
 }return archive;
}
describe('explicit historical adoption',()=>{
 it('adopts latest historical AI report 2 April and notes 7 May without old versions',()=>{expect(historicalAdoptionPlan(fixture()).targets).toEqual(['1','2']);});
 it('never adopts agenda-only 4 June 2026',()=>{const p=historicalAdoptionPlan(fixture());expect(p.targets).not.toContain('3');expect(p.exceptions.some(e=>e.date==='2026-06-04')).toBe(true);});
 it('preserves 6 November 2026 concept and later versions',()=>{const a=fixture();a.versions.push({...a.versions[0],id:'later',meeting_id:'1',version:3,meeting_date:'2026-11-07'} as MinutesArchive['versions'][number]);expect(historicalAdoptionPlan(a).targets).toEqual(['2']);expect(historicalAdoptionPlan(a).targets).not.toContain('4');});
 it('requires original attachment and skips already adopted latest',()=>{const a=fixture();a.files=a.files.filter(f=>f.version_id!=='1');a.adoptions.push({id:'a',version_id:'2',adopted_at:'2026-11-09',adopted_by:'synthetic'});expect(historicalAdoptionPlan(a).targets).toEqual([]);});
 it('status reflects adoption only; missing report is independent',()=>{const d=fixture().imports?.[2]?.details;expect(minutesStatus(false,d)).toBe('Concept');expect(minutesStatus(true,d)).toBe('Vastgesteld');expect(d?.reportMissing).toBe(true);});
 it('planning never changes source texts, files or versions',()=>{const a=fixture(),before=JSON.stringify(a);historicalAdoptionPlan(a);expect(JSON.stringify(a)).toBe(before);});
});