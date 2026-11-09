import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { adoptHistoricalBoardMinutes } from '@/lib/boardMinutes.functions';
import { historicalAdoptionPlan } from '@/lib/boardMinutesAdoption';
import type { MinutesArchive } from '@/lib/boardMinutes';

export function MinutesBulkAdopt({archive,onComplete}:{archive:MinutesArchive;onComplete:()=>Promise<void>}){
  const adopt=useServerFn(adoptHistoricalBoardMinutes);
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<number|null>(null);
  const plan=historicalAdoptionPlan(archive);
  if(!archive.canManage)return null;
  async function confirm(){
    if(busy||!plan.targets.length)return;
    setBusy(true);setError('');
    try{const response=await adopt({data:{versionIds:plan.targets,confirm:true}});setResult(response.count);setOpen(false);}
    catch(e){setError(e instanceof Error?e.message:'Vaststellen mislukt.');return;}
    finally{setBusy(false);}
    try{await onComplete();}catch{setError('Bevestiging opgeslagen; vernieuw het overzicht om de status te zien.');}
  }
  return <>
    <Button variant="outline" disabled={busy||!plan.targets.length} onClick={()=>{setError('');setOpen(true);}}><Check size={16}/>Historische notulen vaststellen</Button>
    {result!==null&&<p role="status">{result} historische notulen vastgesteld.</p>}
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent><DialogHeader><DialogTitle>Historische notulen vaststellen</DialogTitle><DialogDescription>{plan.targets.length} nieuwste historische versies vóór 6 november 2026 worden vastgesteld. Teksten, bestanden en eerdere versies blijven ongewijzigd.</DialogDescription></DialogHeader>
      <p className="text-sm">Bevestiging door jouw beheerdersaccount nu, met herkomst gebruikersopdracht. Geen historische vaststellingsdatum.</p>
      <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-sm">{plan.exceptions.map((item,i)=><li key={i}>{item.date}: {item.reason}</li>)}</ul>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Annuleren</Button><Button disabled={busy||!plan.targets.length} onClick={()=>void confirm()}>{busy?'Vaststellen…':`Bevestig ${plan.targets.length} historische notulen`}</Button></div>
    </DialogContent></Dialog>
  </>;
}