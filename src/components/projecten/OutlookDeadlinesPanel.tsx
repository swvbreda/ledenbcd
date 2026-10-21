import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { outlookDeadlineStatus, configureOutlookDeadlines, dispatchOutlookDeadlines } from '@/lib/outlookDeadlines.functions';
const labels: Record<string,string> = { pending: 'Wacht op verwerking', blocked: 'Niet gekoppeld', inflight: 'In verwerking', synced: 'In Outlook vastgelegd', removed: 'Deadline-item verwijderd', conflict: 'Conflict — controleer Outlook', uncertain: 'Uitkomst onbekend — controleer Outlook', failed: 'Mislukt' };
export default function OutlookDeadlinesPanel({ tasks }: { tasks: { id: string; title: string }[] }) {
 const { user } = useAuth(); const qc = useQueryClient();
 const status = useServerFn(outlookDeadlineStatus); const configure = useServerFn(configureOutlookDeadlines); const dispatch = useServerFn(dispatchOutlookDeadlines);
 const key = ['outlook-deadlines', user?.id];
 const q = useQuery({ queryKey: key, enabled: !!user, queryFn: () => status(), refetchInterval: 20000, retry: false });
 const change = useMutation({ mutationFn: (enabled: boolean) => configure({ data: { enabled, confirm: true } }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
 const sync = useMutation({ mutationFn: () => dispatch({ data: { confirm: true } }), onSettled: () => qc.invalidateQueries({ queryKey: key }) });
 return <section className="space-y-3 border-b border-border pb-5" aria-labelledby="outlook-deadlines-title">
 <h2 id="outlook-deadlines-title" className="font-display uppercase">Outlook-taakdeadlines</h2>
 <p className="text-sm text-muted-foreground">Hele-dag deadline, zonder tijdsblok. Outlook blijft vrij. Popupherinnering uit: er is geen meldingstijd afgesproken.</p>
 {q.isPending ? <p role="status">Status ophalen…</p> : q.error ? <p role="alert" className="text-destructive">{q.error.message}</p> : <>
 <div className="flex flex-wrap items-center gap-3"><Switch id="deadline-enable" checked={q.data.enabled} disabled={!q.data.releaseReady || change.isPending} onCheckedChange={v => { if (window.confirm(v ? 'Outlook-deadlines activeren voor toekomstige taakwijzigingen? Geen bestaande taken importeren.' : 'Outlook-deadlines pauzeren? Bestaande items blijven staan tot verwerking hervat.')) change.mutate(v); }} /><label htmlFor="deadline-enable">Synchronisatie {q.data.enabled ? 'aan' : 'uit'}</label></div>
 {!q.data.releaseReady && <p className="text-sm">Activatie geblokkeerd: koppeling en release nog niet vrijgegeven.</p>}
 <p className="text-sm">Automatische verwerking: {!q.data.scheduler ? 'niet geïnstalleerd / status niet beschikbaar' : !q.data.internalConfigured || !q.data.scheduler.vaultConfigured ? 'interne koppeling ontbreekt' : !q.data.scheduler.installed ? 'planning niet geïnstalleerd' : !q.data.scheduler.armed ? 'veilig uit' : q.data.scheduler.active ? 'gepland' : 'wacht op nieuwe taakwijziging'}</p>
 <p className="text-sm">Bevestigde Microsoft-accounts: {q.data.mappings}</p>
 <p className="text-sm text-muted-foreground">Agenda vereist Calendars.ReadWrite; Planner/To Do gebruikt afzonderlijk Tasks.ReadWrite.All. Geen uitnodigingen of extra e-mails.</p>
 <Button variant="outline" disabled={!q.data.enabled || !q.data.releaseReady || sync.isPending} onClick={() => sync.mutate()}>Deadline-items bijwerken</Button>
 {sync.data && <p role="status">{sync.data.processed} deadline-items verwerkt.</p>}
 {!q.data.rows.length ? <p className="text-sm text-muted-foreground">Geen deadline-items in de wachtrij. Bestaande taken worden niet automatisch ingevoerd.</p> : <ul className="space-y-2">{q.data.rows.map(row => <li key={row.task_id} className="border-t border-border pt-2 text-sm break-words"><span className="font-medium">{tasks.find(t => t.id === row.task_id)?.title ?? 'Taak'}</span> — {labels[row.state] ?? row.state}{row.last_error && <p className="text-destructive">{row.last_error}</p>}</li>)}</ul>}
 </>}
 {(change.error || sync.error) && <p role="alert" className="text-destructive">{change.error?.message ?? sync.error?.message}</p>}
 </section>;
}
