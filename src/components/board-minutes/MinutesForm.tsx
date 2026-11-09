import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MINUTES_ACCEPT, minutesSaveSchema, type MinutesInput, type MinuteVersion, type MinuteMeeting } from '@/lib/boardMinutes';
import { extractMinutesText } from '@/lib/boardMinutesExtract';
import type { MinuteActionRow } from '@/lib/boardMinutesTasks';
import type { ImportDetails } from '@/lib/boardMinutesImport';
import { useMinutesTaskStatus } from './MinutesTaskStatus';
import { useAuth } from '@/hooks/useAuth';

export function MinutesForm({ meeting, version, details, onSave, onClose }: { meeting?: MinuteMeeting; version?: MinuteVersion; details?:ImportDetails; onSave: (input: MinutesInput, file: File | null) => Promise<void>; onClose: () => void }) {
  const [date,setDate]=useState(version?.meeting_date ?? '');
  const [title,setTitle]=useState(version?.title ?? '');
  const [report,setReport]=useState(version?.report ?? '');
  const [decisions,setDecisions]=useState(version?.decisions.join('\n') ?? '');
  const [actions,setActions]=useState(version?.actions.join('\n') ?? '');
  const auth=useAuth();
  const taskInfo=useMinutesTaskStatus(version?.id??'00000000-0000-0000-0000-000000000000',auth.user?.id??'');
  const [structured,setStructured]=useState<MinuteActionRow[]|null>(null);
  const currentRows=structured??(taskInfo.data?.rows.length?taskInfo.data.rows.map(r=>({action_id:r.action_id??undefined,action:r.action,owner:r.owner,deadline:r.deadline})):details?.action_rows);
  const [source,setSource]=useState<MinutesInput['source']>((meeting?.source as MinutesInput['source']) ?? 'upload');
  const [sourceId,setSourceId]=useState(meeting?.source_id ?? '');
  const [sourceUrl,setSourceUrl]=useState(version?.source_url ?? '');
  const [file,setFile]=useState<File|null>(null);
  const [confirm,setConfirm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [extracting,setExtracting]=useState(false);
  async function readFile() {if(!file||extracting)return;setExtracting(true);setError('');try{const text=await extractMinutesText(file);if(!text.trim())throw new Error('Geen leesbare tekst gevonden; voeg de verslagtekst handmatig toe.');setReport(text);}catch(e){setError(e instanceof Error?e.message:'Verslagtekst lezen mislukt.');}finally{setExtracting(false);}}
  async function submit(e: FormEvent) {
    e.preventDefault(); if(saving) return; setError('');
    if(version&&taskInfo.isPending){setError('Wacht tot de gekoppelde acties geladen zijn.');return;}
    const rows=currentRows?.length?currentRows:undefined;
    const parsed=minutesSaveSchema.safeParse({ meetingId: meeting?.id ?? null, expectedVersion: version?.id ?? null, source, sourceId, date,title,report,decisions: decisions.split('\n').map(s=>s.trim()).filter(Boolean), actions:rows?rows.map(r=>r.action):actions.split('\n').map(s=>s.trim()).filter(Boolean), action_rows:rows,sourceUrl,confirm });
    if(!parsed.success) {setError(parsed.error.issues[0]?.message ?? 'Controleer de velden.');return;}
    if(!version && !file) {setError('Voeg het oorspronkelijke bestand toe.');return;}
    setSaving(true);
    try {await onSave(parsed.data,file);onClose();} catch(e) {setError(e instanceof Error ? e.message:'Opslaan mislukt.');} finally {setSaving(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose();}}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>{version?'Nieuwe conceptversie':'Bestuursnotulen toevoegen'}</DialogTitle><DialogDescription>{version?'Bestaande versies en oorspronkelijke bestanden blijven bewaard.':'Oorspronkelijk verslag'}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm">Vergaderdatum<Input aria-label="Vergaderdatum" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label className="space-y-1 text-sm">Titel<Input aria-label="Titel" required maxLength={300} value={title} onChange={e=>setTitle(e.target.value)}/></label></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm">Bron<select aria-label="Bron" disabled={!!meeting} value={source} onChange={e=>setSource(e.target.value as MinutesInput['source'])} className="h-10 w-full rounded-md border border-input bg-background px-3"><option value="upload">Upload</option><option value="onedrive">OneDrive</option><option value="topical">Topical</option></select></label><label className="space-y-1 text-sm">Bron-id<Input aria-label="Bron-id" disabled={!!meeting} required={source!=='upload'} maxLength={500} value={sourceId} onChange={e=>setSourceId(e.target.value)}/></label></div>
    <label className="block space-y-1 text-sm">Bronverwijzing<Input aria-label="Bronverwijzing" type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/></label>
    <label className="block space-y-1 text-sm">Oorspronkelijk bestand<Input aria-label="Oorspronkelijk bestand" type="file" accept={MINUTES_ACCEPT} required={!version} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
    {file&&<Button type="button" variant="outline" disabled={extracting||saving} onClick={readFile}>{extracting?'Verslagtekst lezen…':'Verslagtekst uit bestand overnemen'}</Button>}
    <label className="block space-y-1 text-sm">Verslag<Textarea aria-label="Verslag" rows={9} maxLength={200000} value={report} onChange={e=>setReport(e.target.value)}/></label>
    <label className="block space-y-1 text-sm">Besluiten<Textarea aria-label="Besluiten" rows={4} value={decisions} onChange={e=>setDecisions(e.target.value)}/></label>
    {currentRows?.length?<section className="space-y-3"><h3 className="font-medium">Acties</h3>{currentRows.map((r,i)=><div key={r.action_id??i} className="grid gap-2 sm:grid-cols-3">{(['action','owner','deadline'] as const).map((key,j)=><label key={key} className="text-sm">{['Actie','Verantwoordelijke','Termijn'][j]}<Input aria-label={`${key}-${i+1}`} value={r[key]} onChange={e=>setStructured(currentRows.map((x,k)=>k===i?{...x,[key]:e.target.value}:x))}/></label>)}</div>)}<Button type="button" variant="outline" onClick={()=>setStructured([...currentRows,{action_id:crypto.randomUUID(),action:'',owner:'',deadline:''}])}>Actie toevoegen</Button></section>:<><label className="block space-y-1 text-sm">Acties<Textarea aria-label="Acties" rows={4} value={actions} onChange={e=>setActions(e.target.value)}/></label><Button type="button" variant="outline" onClick={()=>setStructured([{action_id:crypto.randomUUID(),action:'',owner:'',deadline:''}])}>Actie met verantwoordelijke toevoegen</Button></>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)} className="mt-1 accent-primary"/>Dit zijn bestuursnotulen, geen ALV of extern overleg.</label>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Annuleren</Button><Button type="submit" disabled={saving}>{saving?'Opslaan…':'Concept opslaan'}</Button></div>
  </form></DialogContent></Dialog>;
}