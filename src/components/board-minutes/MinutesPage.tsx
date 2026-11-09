import { Component, Suspense, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { queryOptions, QueryErrorResetBoundary, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, FileText, Plus, Search, Printer, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { adoptBoardMinutes, loadBoardMinutes, saveBoardMinutes, uploadBoardMinutesFile } from '@/lib/boardMinutes.functions';
import { downloadMinutesBlob, filterMinutes, MINUTES_BUCKET, minutesSourceLabel, safeMinutesUrl, validateMinutesBytes, type MinutesInput, type MinutesArchive, type MinuteFile, type MinuteVersion } from '@/lib/boardMinutes';
import { MinutesForm } from './MinutesForm';
import { MinutesDownload } from './MinutesDownload';
import { MinutesImport } from './MinutesImport';
import { MinutesDocument } from './MinutesDocument';
import { minutesStatus } from '@/lib/boardMinutesImport';
import { MinutesTaskControls,useMinutesTaskStatus } from './MinutesTaskStatus';

export const minutesQuery = (userId: string) => queryOptions({ queryKey: ['board-minutes',userId], queryFn: () => loadBoardMinutes(), staleTime: 0 });
class Boundary extends Component<{ children: ReactNode; reset: ()=>void }, {failed:boolean}> {
  override state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  override render(){return this.state.failed?<div role="alert" className="space-y-3 p-6"><p>Bestuursnotulen konden niet worden geladen of je hebt geen toegang.</p><Button variant="outline" onClick={()=>{this.props.reset();this.setState({failed:false});}}>Opnieuw proberen</Button></div>:this.props.children;}
}
export default function MinutesPage({id}:{id?:string}) {
  const auth=useAuth();
  if(auth.loading)return <p role="status" className="p-6">Notulen laden…</p>;
  if(!auth.user||!(auth.isAdmin||auth.isBoard))return <p role="alert" className="p-6">Deze pagina is alleen toegankelijk voor bestuur en beheerders.</p>;
  return <QueryErrorResetBoundary>{({reset})=><Boundary key={`${auth.user?.id}:${id??'index'}`} reset={reset}><Suspense fallback={<p role="status" className="p-6">Notulen laden…</p>}><MinutesContent id={id} userId={auth.user?.id??''}/></Suspense></Boundary>}</QueryErrorResetBoundary>;
}
function MinutesContent({id,userId}:{id?:string;userId:string}) {
  const {data}=useSuspenseQuery(minutesQuery(userId));
  const qc=useQueryClient();const navigate=useNavigate();
  const save=useServerFn(saveBoardMinutes);const upload=useServerFn(uploadBoardMinutesFile);const adopt=useServerFn(adoptBoardMinutes);
  const [editing,setEditing]=useState(false);const [confirmAdopt,setConfirmAdopt]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [importing,setImporting]=useState(false);
  const [chosen,setChosen]=useState<string>('');
  const meeting=data.meetings.find(m=>m.id===id);
  const versions=data.versions.filter(v=>v.meeting_id===id).sort((a,b)=>b.version-a.version);
  const latest=versions[0];const version=versions.find(v=>v.id===chosen)??latest;
  const tasks=useMinutesTaskStatus(version?.id??'00000000-0000-0000-0000-000000000000',userId);
  const adopted=data.adoptions.find(a=>a.version_id===version?.id);
  const imported=data.imports?.find(d=>d.version_id===version?.id);
  const status=minutesStatus(!!adopted,imported?.details);
  async function refresh(){await qc.invalidateQueries({queryKey:minutesQuery(userId).queryKey});}
  async function saveInput(input:MinutesInput,file:File|null){
    let sourceId=input.sourceId;
    let fileHash:string|null=null;
    if(file){const bytes=new Uint8Array(await file.arrayBuffer());validateMinutesBytes(file.name,bytes);const hash=await crypto.subtle.digest('SHA-256',bytes);fileHash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');if(!input.meetingId&&input.source==='upload'&&!sourceId)sourceId=fileHash;}
    const saved=await save({data:{...input,sourceId,fileHash}});
    try {if(file){const form=new FormData();form.set('versionId',saved.id);form.set('file',file);await upload({data:form});}}
    catch(e){await refresh();await navigate({to:'/bestuur/notulen/$id',params:{id:saved.meeting_id}});throw new Error(`Concept opgeslagen; originele bijlage nog niet gekoppeld. ${e instanceof Error?e.message:''}`);}
    await refresh();setChosen(saved.id);await navigate({to:'/bestuur/notulen/$id',params:{id:saved.meeting_id}});
  }
  async function attach(file:File|null){if(!file||!version||busy)return;setBusy(true);setError('');try{const form=new FormData();form.set('versionId',version.id);form.set('file',file);await upload({data:form});await refresh();}catch(e){setError(e instanceof Error?e.message:'Upload mislukt.');}finally{setBusy(false);}}
  async function establish(){if(!version||busy)return;setBusy(true);setError('');try{await adopt({data:{versionId:version.id,confirm:true}});await refresh();setConfirmAdopt(false);}catch(e){setError(e instanceof Error?e.message:'Vaststellen mislukt.');}finally{setBusy(false);}}
  if(id&&(!meeting||!version))return <div className="space-y-4 p-6"><h1 className="font-display text-2xl">Vergadering niet gevonden</h1><Button asChild variant="outline"><Link to="/bestuur/notulen">Terug naar notulen</Link></Button></div>;
  return <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
    <header className="space-y-2"><p className="text-sm text-muted-foreground">Bestuur</p><h1 className="break-words font-display text-2xl sm:text-3xl">{version?version.title:'Vergaderingen en notulen'}</h1></header>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {!id?<><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{data.meetings.length} vergaderingen</span>{data.canManage&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setImporting(true)}><Upload size={16}/>Archief importeren</Button><Button onClick={()=>setEditing(true)}><Plus size={16}/>Notulen toevoegen</Button></div>}</div><MinutesOverview archive={data}/></>:version&&meeting?<>
      <div className="flex flex-wrap justify-between gap-3"><Button asChild variant="outline"><Link to="/bestuur/notulen"><ArrowLeft size={16}/>Alle notulen</Link></Button>{data.canManage&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setEditing(true)}><Plus size={16}/>Nieuwe conceptversie</Button>{version.id===latest?.id&&!adopted&&<Button disabled={busy||!data.files.some(f=>f.version_id===version.id)} onClick={()=>setConfirmAdopt(true)}><Check size={16}/>Vaststellen</Button>}</div>}</div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><time dateTime={version.meeting_date}>{formatDate(version.meeting_date)}</time><Badge variant={adopted?'default':'secondary'}>{status}</Badge><span>{minutesSourceLabel(meeting.source)} · versie {version.version}</span></div>
      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]"><div className="min-w-0 space-y-7"><Button className="minutes-no-print" variant="outline" onClick={()=>window.print()}><Printer size={16}/>Afdrukken</Button><MinutesDocument version={version} details={imported?.details} status={status} tasks={tasks.data?.rows}/><MinutesTaskControls versionId={version.id} userId={userId} canActivate={data.canManage&&version.id===latest?.id&&meeting.id==='f9c3a642-13e8-42bd-891e-07495be20312'&&!adopted}/>{imported?.source_text&&<details className="minutes-no-print border-t border-border pt-4"><summary className="cursor-pointer font-medium">Volledige brontekst {imported.details.reportMissing?'(agenda / besluiten / acties)':''}</summary><p className="mt-4 whitespace-pre-wrap break-words text-sm">{imported.source_text}</p></details>}
        <section className="space-y-3 border-t border-border pt-5"><h2 className="font-display text-xl">Oorspronkelijke bestanden en bijlagen</h2>{data.files.filter(f=>f.version_id===version.id).map(f=><div key={f.id} className="flex min-w-0 items-center justify-between gap-3 border-b border-border py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{f.original_name}</p><p className="text-xs text-muted-foreground">{(f.size_bytes/1024).toFixed(1)} KB · {formatDate(f.created_at.slice(0,10))}</p></div><MinutesDownload file={f} onError={setError}/></div>)}{!data.files.some(f=>f.version_id===version.id)&&<p className="text-sm text-muted-foreground">Nog geen oorspronkelijk bestand gekoppeld.</p>}{data.canManage&&!adopted&&version.id===latest?.id&&<label className="block space-y-2 text-sm">Bijlage toevoegen<Input type="file" aria-label="Bijlage toevoegen" accept=".pdf,.docx,.doc,.txt" disabled={busy} onChange={e=>{void attach(e.target.files?.[0]??null);e.target.value='';}}/></label>}</section>
      </div><aside className="min-w-0 space-y-6 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"><section className="space-y-3"><h2 className="font-display text-lg">Versiegeschiedenis</h2>{versions.map(v=><Button key={v.id} variant={version.id===v.id?'secondary':'ghost'} className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>setChosen(v.id)}>Versie {v.version} · {minutesStatus(data.adoptions.some(a=>a.version_id===v.id),data.imports?.find(d=>d.version_id===v.id)?.details)}<br/>{formatDate(v.created_at.slice(0,10))}</Button>)}</section><section className="space-y-2"><h2 className="font-display text-lg">Herkomst</h2><p className="break-words text-sm">{minutesSourceLabel(meeting.source)}</p><p className="break-all text-xs text-muted-foreground">{meeting.source_id}</p>{version.source_url&&safeMinutesUrl(version.source_url)&&<a href={safeMinutesUrl(version.source_url)??undefined} target="_blank" rel="noopener noreferrer" className="break-words text-sm text-primary underline">Oorspronkelijke bron</a>}{adopted&&<p className="text-sm">Vastgesteld op {formatDate(adopted.adopted_at.slice(0,10))}</p>}</section></aside></div>
    </>:null}
    {importing&&<MinutesImport onClose={()=>setImporting(false)} onComplete={refresh}/>}
    {editing&&<MinutesForm meeting={meeting} version={latest} onSave={saveInput} onClose={()=>setEditing(false)}/>}
    {confirmAdopt&&<Dialog open onOpenChange={o=>{if(!o&&!busy)setConfirmAdopt(false);}}><DialogContent><DialogHeader><DialogTitle>Notulen vaststellen?</DialogTitle><DialogDescription>Versie {version?.version} wordt vastgesteld. Verslag en bijlagen blijven daarna ongewijzigd; aanvullingen krijgen een nieuwe conceptversie.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setConfirmAdopt(false)}>Annuleren</Button><Button disabled={busy} onClick={establish}>{busy?'Vaststellen…':'Definitief vaststellen'}</Button></div></DialogContent></Dialog>}
  </div>;
}
const formatDate=(value:string)=>new Date(value+'T00:00:00').toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'});
function TextSection({title,text}:{title:string;text:string}){return <section className="space-y-3"><h2 className="font-display text-xl">{title}</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text||'Nog niet ingevuld.'}</p></section>;}
function ListSection({title,items}:{title:string;items:string[]}){return <section className="space-y-3"><h2 className="font-display text-xl">{title}</h2>{items.length?<ol className="list-decimal space-y-3 pl-5 text-sm">{items.map((item,i)=><li key={i} className="whitespace-pre-wrap break-words pl-1">{item}</li>)}</ol>:<p className="text-sm text-muted-foreground">Nog niet vastgelegd.</p>}</section>;}
export function MinutesOverview({archive}:{archive:MinutesArchive}){
  const [query,setQuery]=useState('');const[year,setYear]=useState('');
  const results=filterMinutes(archive,query,year);
  const years=Array.from(new Set(archive.versions.map(v=>v.meeting_date.slice(0,4)))).sort().reverse();
  return <section className="min-w-0 space-y-4"><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><div className="relative"><Search size={17} className="absolute left-3 top-3 text-muted-foreground"/><Input aria-label="Zoek notulen" placeholder="Zoek inhoud of onderwerp…" value={query} onChange={e=>setQuery(e.target.value)} className="pl-10"/></div><select aria-label="Jaar" value={year} onChange={e=>setYear(e.target.value)} className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm"><option value="">Alle jaren</option>{years.map(y=><option key={y}>{y}</option>)}</select></div>{(query||year)&&<div className="flex items-center gap-3 text-sm"><span>{results.length} resultaten</span><Button size="sm" variant="ghost" onClick={()=>{setQuery('');setYear('');}}>Filters wissen</Button></div>}
    <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[640px] border-collapse text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{['Datum','Titel','Status','Bron'].map(h=><th key={h} className="border-b border-border px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{results.map(({meeting,latest,matchingVersion})=><tr key={meeting.id} className="border-b border-border"><td className="whitespace-nowrap px-3 py-4">{formatDate(latest.meeting_date)}</td><td className="px-3 py-4"><Link to="/bestuur/notulen/$id" params={{id:meeting.id}} className="font-medium text-primary hover:underline">{latest.title}</Link>{matchingVersion!==latest.id&&<p className="text-xs text-muted-foreground">Treffer in eerdere versie</p>}</td><td className="px-3 py-4"><Badge variant={archive.adoptions.some(a=>a.version_id===latest.id)?'default':'secondary'}>{minutesStatus(archive.adoptions.some(a=>a.version_id===latest.id),archive.imports?.find(d=>d.version_id===latest.id)?.details)}</Badge></td><td className="px-3 py-4">{minutesSourceLabel(meeting.source)}</td></tr>)}</tbody></table></div>{!results.length&&<div className="flex flex-col items-center gap-3 py-10 text-muted-foreground"><FileText size={30}/><p>{archive.meetings.length?'Geen notulen gevonden.':'Nog geen bestuursnotulen opgeslagen.'}</p></div>}
  </section>;
}