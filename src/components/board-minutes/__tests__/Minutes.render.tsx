import { describe,it,expect,vi,afterEach } from 'vitest';
import { render,screen,fireEvent,cleanup,waitFor } from '@testing-library/react';
import { MinutesOverview } from '../MinutesPage';
import { MinutesForm } from '../MinutesForm';
import { MinutesImport } from '../MinutesImport';
import { MinutesBulkAdopt } from '../MinutesBulkAdopt';
import { adoptHistoricalBoardMinutes } from '@/lib/boardMinutes.functions';
import type { MinutesArchive } from '@/lib/boardMinutes';
vi.mock('@tanstack/react-router',()=>({Link:({children,...props}:any)=><a href={props.to}>{children}</a>,useNavigate:()=>vi.fn()}));
vi.mock('@tanstack/react-start',()=>({useServerFn:(fn:any)=>fn,createServerFn:()=>({middleware(){return this;},inputValidator(){return this;},handler(){return vi.fn();}})}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
vi.mock('@/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
afterEach(cleanup);
const archive:MinutesArchive={canManage:false,meetings:[{id:'m',source:'topical',source_id:'1',created_at:'',created_by:''}],versions:[{id:'v',meeting_id:'m',version:1,meeting_date:'2026-11-06',title:'Synthetische bestuursvergadering',report:'Vergunningen besproken',decisions:['Bezwaar indienen'],actions:['Planning controleren'],source_url:null,content_hash:'',created_at:'',created_by:''}],files:[],adoptions:[]};
describe('notulen overzicht',()=>{
 it('bulk confirmation submits only previewed latest historical version, after explicit confirmation',async()=>{
  const a:MinutesArchive={...archive,canManage:true,versions:archive.versions.map(v=>({...v,id:'11111111-1111-4111-8111-111111111111',meeting_date:'2026-04-02'})),files:[{id:'f',version_id:'11111111-1111-4111-8111-111111111111',path:'synthetic.pdf',original_name:'synthetic.pdf',sha256:'',size_bytes:1,created_at:'',created_by:''}],imports:[{version_id:'11111111-1111-4111-8111-111111111111',source_text:'Synthetic',details:{status:'historisch-onbevestigd',reviewRequired:true,reportMissing:false,reportKind:'ai-report',meetingType:'bestuursvergadering',originalName:'',sourcePaths:[],dateBasis:'',versionLabel:''}}]};
  const command=vi.mocked(adoptHistoricalBoardMinutes);command.mockResolvedValue({count:1});const complete=vi.fn().mockResolvedValue(undefined);
  render(<MinutesBulkAdopt archive={a} onComplete={complete}/>);fireEvent.click(screen.getByRole('button',{name:'Historische notulen vaststellen'}));expect(command).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Bevestig 1 historische notulen'}));await waitFor(()=>expect(command).toHaveBeenCalledWith({data:{versionIds:['11111111-1111-4111-8111-111111111111'],confirm:true}}));await waitFor(()=>expect(complete).toHaveBeenCalled());
 });
 it('board-only readers cannot submit bulk adoption',()=>{render(<MinutesBulkAdopt archive={archive} onComplete={vi.fn()}/>);expect(screen.queryByRole('button')).toBeNull();});
 it('import requires both ZIP selection and explicit confirmation before submission',()=>{render(<MinutesImport onClose={vi.fn()} onComplete={vi.fn()}/>);const command=screen.getByRole('button',{name:'Privé importeren'});expect(command.hasAttribute('disabled')).toBe(true);fireEvent.change(screen.getByLabelText('Archiefpakket'),{target:{files:[new File(['synthetic only'],'synthetic.zip',{type:'application/zip'})]}});expect(command.hasAttribute('disabled')).toBe(true);fireEvent.click(screen.getByRole('checkbox'));expect(command.hasAttribute('disabled')).toBe(false);});
 it('zoekt op verslag, besluiten en acties en combineert jaarfilter',()=>{render(<MinutesOverview archive={archive}/>);fireEvent.change(screen.getByLabelText('Zoek notulen'),{target:{value:'Bezwaar'}});expect(screen.getByRole('link')).toBeTruthy();fireEvent.change(screen.getByLabelText('Zoek notulen'),{target:{value:'Planning'}});expect(screen.getByRole('link')).toBeTruthy();fireEvent.change(screen.getByLabelText('Zoek notulen'),{target:{value:'Geen match'}});expect(screen.queryByRole('link')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Filters wissen'}));expect(screen.getByRole('link')).toBeTruthy();});
 it('leeg archief bevat geen verzonnen verslagen',()=>{render(<MinutesOverview archive={{...archive,meetings:[],versions:[]}}/>);expect(screen.queryByRole('link')).toBeNull();});
 it('opslaan vereist echte originele bijlage en bestuursbevestiging',async()=>{const save=vi.fn();render(<MinutesForm onSave={save} onClose={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Vergaderdatum'),{target:{value:'2026-11-06'}});fireEvent.change(screen.getByLabelText('Titel'),{target:{value:'Test'}});fireEvent.click(screen.getByLabelText(/Dit zijn bestuursnotulen/));fireEvent.submit(screen.getByRole('button',{name:'Concept opslaan'}).closest('form') as HTMLFormElement);await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());expect(save).not.toHaveBeenCalled();});
});