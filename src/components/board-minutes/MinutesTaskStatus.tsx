import { useState } from 'react';
import { Link } from '@/lib/router-compat';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { activateMinutesTasks,assignMinutesTask,loadMinutesTasks,setMinutesTaskStatus } from '@/lib/boardMinutesTasks.functions';
import type { MinutesTaskRow } from '@/lib/boardMinutesTasks';
import { taskResponsibles } from '@/lib/boardMinutesTasks';

export function useMinutesTaskStatus(versionId:string,userId:string){
  return useQuery({queryKey:['minutes-tasks',userId,versionId],enabled:!!userId&&versionId!=='00000000-0000-0000-0000-000000000000',queryFn:()=>loadMinutesTasks({data:{versionId}}),refetchInterval:5000,refetchOnWindowFocus:true,retry:false});
}
export function MinutesTaskControls({versionId,userId,canActivate}:{versionId:string;userId:string;canActivate:boolean}){
  const q=useMinutesTaskStatus(versionId,userId);const qc=useQueryClient();
  const activate=useServerFn(activateMinutesTasks),assign=useServerFn(assignMinutesTask),setStatus=useServerFn(setMinutesTaskStatus);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
  const [editing,setEditing]=useState<MinutesTaskRow|null>(null),[people,setPeople]=useState<string[]>([]);
  async function run(fn:()=>Promise<unknown>){setBusy(true);setError('');try{await fn();await Promise.all([qc.invalidateQueries({queryKey:['minutes-tasks',userId]}),qc.invalidateQueries({queryKey:['internal-tasks',userId]})]);setConfirm(false);setEditing(null);}catch(e){setError(e instanceof Error?e.message:'Taakwijziging mislukt.');}finally{setBusy(false);}}
  async function status(t:MinutesTaskRow){if(!t.task_id)return;await setStatus({data:{taskId:t.task_id,completed:t.status!=='afgerond'}});}
  const showControls=!!q.data&&(q.data.can_manage||q.data.rows.some(t=>t.can_status));
  return <section className="minutes-no-print space-y-3 border-t border-border pt-5" aria-label="Actuele bestuurstaken"><h2 className="font-display text-xl">Actuele bestuurstaken</h2>
    {q.isPending&&<p role="status">Taken laden…</p>}{(error||q.error)&&<p role="alert" className="text-destructive">{error||'Actuele taken konden niet worden geladen.'}</p>}
    {canActivate&&q.data&&!q.data.enabled&&<Button onClick={()=>setConfirm(true)}>15 conceptacties aan taken koppelen</Button>}
    {!!q.data?.rows.length&&<div className="max-w-full overflow-x-auto"><table className="w-full min-w-[40rem] border-collapse text-left text-sm" aria-label="Actuele bestuurstaken"><thead className="bg-muted text-muted-foreground"><tr>{['Actie','Verantwoordelijke','Deadline','Status',...(showControls?[q.data.can_manage?'Beheer':'Bediening']:[])].map(h=><th scope="col" key={h} className="border-b border-border p-2 font-medium">{h}</th>)}</tr></thead><tbody>{q.data.rows.map(t=><tr key={t.action_id} className="align-top"><td className="border-b border-border p-2 break-words font-medium">{t.action}</td><td className="border-b border-border p-2 break-words">{taskResponsibles(t)}{t.needs_assignment?(t.collective_board?' · Accountkoppeling nodig':t.assignees.length>0?' · Overige toewijzing nodig':''):''}</td><td className="border-b border-border p-2">{t.deadline||'Niet vastgelegd'}</td><td className="border-b border-border p-2">{t.status==='afgerond'?'Afgerond':'Open'}{t.completed_at&&<p className="text-xs text-muted-foreground">Afgerond door {t.completed_name||'Niet geregistreerd'} op {new Date(t.completed_at).toLocaleString('nl-NL')}</p>}</td>
      {showControls&&<td className="border-b border-border p-2"><div className="flex flex-wrap gap-2">{q.data.can_manage&&<Button asChild size="sm" variant="outline"><Link to={`/projecten?task=${t.task_id}`}>Taak openen</Link></Button>}{t.can_status&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(()=>status(t))}>{t.status==='afgerond'?'Heropenen':'Afronden'}</Button>}{q.data.can_manage&&<Button size="sm" variant="outline" onClick={()=>{setEditing(t);setPeople(t.assignees.map(s=>s.user_id));}}>Toewijzing</Button>}</div></td>}
    </tr>)}</tbody></table></div>}
    {confirm&&<Dialog open onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Conceptacties koppelen?</DialogTitle><DialogDescription>Alleen de nieuwste 15 acties van 6 november. Geen oude notulen of berichten.</DialogDescription></DialogHeader><Button disabled={busy} onClick={()=>void run(()=>activate({data:{versionId,confirm:true}}))}>Bevestig taakregistratie</Button></DialogContent></Dialog>}
    {editing&&<Dialog open onOpenChange={o=>{if(!o)setEditing(null);}}><DialogContent><DialogHeader><DialogTitle>Verantwoordelijken kiezen</DialogTitle><DialogDescription>{editing.owner||'Toewijzing nodig'}</DialogDescription></DialogHeader>{q.data?.staff.map(s=><label key={s.user_id} className="flex items-center gap-2"><Checkbox checked={people.includes(s.user_id)} onCheckedChange={v=>setPeople(p=>v?[...p,s.user_id]:p.filter(id=>id!==s.user_id))}/>{s.name}</label>)}<Button disabled={busy} onClick={()=>{const actionId=editing.action_id;if(actionId)void run(()=>assign({data:{actionId,users:people,confirm:true}}));}}>Toewijzing opslaan</Button></DialogContent></Dialog>}
  </section>;
}