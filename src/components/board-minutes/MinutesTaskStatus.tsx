import { useState } from 'react';
import { Link } from '@/lib/router-compat';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { completeTaskLocally } from '@/lib/internalWork';
import { activateMinutesTasks,assignMinutesTask,loadMinutesTasks } from '@/lib/boardMinutesTasks.functions';
import type { MinutesTaskRow } from '@/lib/boardMinutesTasks';

export function useMinutesTaskStatus(versionId:string,userId:string){
  return useQuery({queryKey:['minutes-tasks',userId,versionId],queryFn:()=>loadMinutesTasks({data:{versionId}}),refetchInterval:5000,refetchOnWindowFocus:true,retry:false});
}
export function MinutesTaskControls({versionId,userId,canActivate}:{versionId:string;userId:string;canActivate:boolean}){
  const q=useMinutesTaskStatus(versionId,userId);const qc=useQueryClient();
  const activate=useServerFn(activateMinutesTasks),assign=useServerFn(assignMinutesTask);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
  const [editing,setEditing]=useState<MinutesTaskRow|null>(null),[people,setPeople]=useState<string[]>([]);
  async function run(fn:()=>Promise<unknown>){setBusy(true);setError('');try{await fn();await Promise.all([qc.invalidateQueries({queryKey:['minutes-tasks',userId]}),qc.invalidateQueries({queryKey:['internal-tasks',userId]})]);setConfirm(false);setEditing(null);}catch(e){setError(e instanceof Error?e.message:'Taakwijziging mislukt.');}finally{setBusy(false);}}
  async function status(t:MinutesTaskRow){if(!t.task_id)return;if(t.status!=='afgerond'){await completeTaskLocally(supabase,t.task_id?{id:t.task_id}: {id:''});return;}const{data,error}=await supabase.from('internal_tasks').update({status:'te_doen'}).eq('id',t.task_id).select('id');if(error||!data?.length)throw new Error('Heropenen niet toegestaan.');}
  return <section className="minutes-no-print space-y-3 border-t border-border pt-5" aria-label="Actuele bestuurstaken"><h2 className="font-display text-xl">Actuele bestuurstaken</h2>
    {q.isPending&&<p role="status">Taken laden…</p>}{(error||q.error)&&<p role="alert" className="text-destructive">{error||'Actuele taken konden niet worden geladen.'}</p>}
    {canActivate&&q.data&&!q.data.enabled&&<Button onClick={()=>setConfirm(true)}>15 conceptacties aan taken koppelen</Button>}
    {q.data?.rows.map(t=><div key={t.action_id} className="space-y-2 border-b border-border py-3"><p className="break-words font-medium">{t.action}</p><p className="text-sm">{t.status==='afgerond'?'Afgerond':'Open'} · {t.assignees.map(s=>s.name).join(', ')||'Toewijzing nodig'}{t.needs_assignment&&t.assignees.length>0?' · Overige toewijzing nodig':''}</p>{t.completed_at&&<p className="text-xs text-muted-foreground">Afgerond door {t.completed_name||'Niet geregistreerd'} op {new Date(t.completed_at).toLocaleString('nl-NL')}</p>}
      {q.data.can_manage&&<div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to={`/projecten?task=${t.task_id}`}>Taak openen</Link></Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(()=>status(t))}>{t.status==='afgerond'?'Heropenen':'Afronden'}</Button><Button size="sm" variant="outline" onClick={()=>{setEditing(t);setPeople(t.assignees.map(s=>s.user_id));}}>Toewijzing</Button></div>}
    </div>)}
    {confirm&&<Dialog open onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Conceptacties koppelen?</DialogTitle><DialogDescription>Alleen de nieuwste 15 acties van 6 november. Geen oude notulen of berichten.</DialogDescription></DialogHeader><Button disabled={busy} onClick={()=>void run(()=>activate({data:{versionId,confirm:true}}))}>Bevestig taakregistratie</Button></DialogContent></Dialog>}
    {editing&&<Dialog open onOpenChange={o=>{if(!o)setEditing(null);}}><DialogContent><DialogHeader><DialogTitle>Verantwoordelijken kiezen</DialogTitle><DialogDescription>{editing.owner||'Toewijzing nodig'}</DialogDescription></DialogHeader>{q.data?.staff.map(s=><label key={s.user_id} className="flex items-center gap-2"><Checkbox checked={people.includes(s.user_id)} onCheckedChange={v=>setPeople(p=>v?[...p,s.user_id]:p.filter(id=>id!==s.user_id))}/>{s.name}</label>)}<Button disabled={busy} onClick={()=>{const actionId=editing.action_id;if(actionId)void run(()=>assign({data:{actionId,users:people,confirm:true}}));}}>Toewijzing opslaan</Button></DialogContent></Dialog>}
  </section>;
}