import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { importBoardReport,importBoardMinutes,uploadBoardMinutesFile,loadBoardMinutes } from '@/lib/boardMinutes.functions';
import { prepareMinutesPackage,sha256,bindFormattedRevisions } from '@/lib/boardMinutesImport';
import { MINUTES_BUCKET } from '@/lib/boardMinutes';
import { supabase } from '@/integrations/supabase/client';

export function MinutesImport({onClose,onComplete}:{onClose:()=>void;onComplete:()=>Promise<void>}){
  const [file,setFile]=useState<File|null>(null),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  const importRevision=useServerFn(importBoardMinutes),importReport=useServerFn(importBoardReport),upload=useServerFn(uploadBoardMinutesFile),loadArchive=useServerFn(loadBoardMinutes);
  async function run(){
    if(!file||!confirm||busy)return;
    setBusy(true);setError('');setStatus('Bestanden en manifest controleren…');
    try{
      if(file.size>200*1024*1024)throw new Error('Pakket is groter dan 200 MB.');
      const {unzipSync}=await import('fflate');
      let expanded=0,count=0;const zipPaths=new Set<string>();
      const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{count++;if(count>1000||zipPaths.has(entry.name))throw new Error('Te veel of dubbele pakketbestanden.');zipPaths.add(entry.name);expanded+=entry.originalSize;if(entry.originalSize>20*1024*1024||expanded>250*1024*1024)throw new Error('Uitgepakt pakket is te groot.');return true;}});
      const prepared=await prepareMinutesPackage(entries);
      // Validate every existing meeting and source before the first append.
      const originals=prepared.originals.some(o=>o.revision.details.formatted)?bindFormattedRevisions(prepared.originals,await loadArchive()):prepared.originals;
      const savedRevisions=new Map<string,{meeting_id:string;id:string}>();
      let done=0;
      for(const original of originals){
        setStatus(`${done} / ${prepared.originals.length} bestanden · ${prepared.meetings} vergaderingen`);
        const key=JSON.stringify(original.revision);
        let saved=savedRevisions.get(key);if(!saved){saved=original.placement?await importReport({data:{revision:original.revision,placement:original.placement}}):await importRevision({data:original.revision});savedRevisions.set(key,saved);}
        const bytes=entries[original.path];if(!bytes)throw new Error('Bestand ontbreekt.');
        const form=new FormData();form.set('versionId',saved.id);form.set('file',new File([new Uint8Array(bytes)],original.name));
        await upload({data:form});
        const ext=original.name.split('.').pop()?.toLowerCase();
        const {data:blob,error:downloadError}=await supabase.storage.from(MINUTES_BUCKET).download(`${saved.meeting_id}/${original.hash}.${ext}`);
        if(downloadError||!blob||await sha256(new Uint8Array(await blob.arrayBuffer()))!==original.hash)throw new Error('Privé terugleescontrole mislukt; import gestopt.');
        done++;
      }
      setStatus(`${prepared.meetings} vergaderingen · ${done} bestanden privé teruggelezen · ${prepared.excluded} uitgesloten items niet geïmporteerd`);
      await onComplete();
    }catch(e){setError(e instanceof Error?e.message:'Import mislukt.');await onComplete();}finally{setBusy(false);}
  }
  return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose();}}><DialogContent><DialogHeader><DialogTitle>Archief importeren</DialogTitle><DialogDescription>Bestuursarchief (OneDrive / Topical) of gespreksverslagen per categorie · historische status te controleren, geen taken of berichten</DialogDescription></DialogHeader>
    <Input type="file" accept=".zip" aria-label="Archiefpakket" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirm} disabled={busy} onChange={e=>setConfirm(e.target.checked)}/>Ik bevestig dat dit een goedgekeurd pakket is: bestuursnotulen of gespreksverslagen met de juiste categorie.</label>
    {status&&<p role="status" className="break-words text-sm">{status}</p>}{error&&<p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Sluiten</Button><Button disabled={!file||!confirm||busy} onClick={run}>{busy?'Importeren…':'Privé importeren'}</Button></div>
  </DialogContent></Dialog>;
}