import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { importBoardMinutes,uploadBoardMinutesFile } from '@/lib/boardMinutes.functions';
import { prepareMinutesPackage,sha256 } from '@/lib/boardMinutesImport';
import { MINUTES_BUCKET } from '@/lib/boardMinutes';
import { supabase } from '@/integrations/supabase/client';

export function MinutesImport({onClose,onComplete}:{onClose:()=>void;onComplete:()=>Promise<void>}){
  const [file,setFile]=useState<File|null>(null),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  const importRevision=useServerFn(importBoardMinutes),upload=useServerFn(uploadBoardMinutesFile);
  async function run(){
    if(!file||!confirm||busy)return;
    setBusy(true);setError('');setStatus('Bestanden en manifest controleren…');
    try{
      if(file.size>200*1024*1024)throw new Error('Pakket is groter dan 200 MB.');
      const {unzipSync}=await import('fflate');
      let expanded=0;
      const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{expanded+=entry.originalSize;if(entry.originalSize>20*1024*1024||expanded>250*1024*1024)throw new Error('Uitgepakt pakket is te groot.');return true;}});
      const prepared=await prepareMinutesPackage(entries);
      let done=0;
      for(const original of prepared.originals){
        setStatus(`${done} / ${prepared.originals.length} bestanden · ${prepared.meetings} vergaderingen`);
        const saved=await importRevision({data:original.revision});
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
  return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose();}}><DialogContent><DialogHeader><DialogTitle>Bestuursarchief importeren</DialogTitle><DialogDescription>OneDrive / Topical · historische status te controleren</DialogDescription></DialogHeader>
    <Input type="file" accept=".zip" aria-label="Archiefpakket" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirm} disabled={busy} onChange={e=>setConfirm(e.target.checked)}/>Ik bevestig dat dit het goedgekeurde bestuursarchief is, zonder ALV of externe overleggen.</label>
    {status&&<p role="status" className="break-words text-sm">{status}</p>}{error&&<p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Sluiten</Button><Button disabled={!file||!confirm||busy} onClick={run}>{busy?'Importeren…':'Privé importeren'}</Button></div>
  </DialogContent></Dialog>;
}