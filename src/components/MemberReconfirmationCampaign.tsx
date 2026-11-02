import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getMemberReconfirmationCampaign, type ReconfirmationCampaignRow } from '@/lib/memberReconfirmationCampaign.functions';
import { reconfirmationParagraphs, RECONFIRMATION_BUTTON, RECONFIRMATION_SUBJECT } from '../../supabase/functions/_shared/memberReconfirmationPolicy';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

const labels: Record<string, string> = { unsent: 'Niet verzonden', sending: 'Verzending gestart', sent: 'Provider heeft mail geaccepteerd', confirmed: 'Lidmaatschap bevestigd', unknown: 'Uitkomst onzeker — niet opnieuw versturen', failed: 'Niet geaccepteerd — controle nodig', suppressed: 'Geblokkeerd door uitschrijving' };
const queryKey = ['member-reconfirmation-campaign'];
export function MemberReconfirmationCampaign() {
  const load = useServerFn(getMemberReconfirmationCampaign);
  const cache = useQueryClient();
  const query = useQuery({ queryKey, queryFn: () => load(), staleTime: 0, refetchInterval: 30_000 });
  const [selected, setSelected] = useState<ReconfirmationCampaignRow | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    if (!selected || sending) return;
    setSending(true); setError('');
    try {
      const response = await supabase.functions.invoke('send-transactional-email', { body: { templateName: 'membership-reconfirmation', requestId: selected.id } });
      if (response.error || response.data?.success !== true) setError('Niet als verzonden bevestigd. Controleer de status hieronder; een onzekere verzending wordt niet herhaald.');
      setSelected(null);
    } catch { setError('Verzenduitkomst onzeker. Controleer de status; niet opnieuw versturen.'); setSelected(null); }
    finally { setSending(false); await cache.invalidateQueries({ queryKey }); }
  }
  return <section className="border-t py-6 space-y-4" aria-labelledby="reconfirmation-title">
    <div className="flex justify-between items-center gap-3"><h2 id="reconfirmation-title" className="text-lg font-bold">Lidmaatschapsbevestiging — november 2026</h2><Button size="icon" variant="outline" aria-label="Bevestigingsstatus vernieuwen" onClick={() => query.refetch()}><RefreshCw size={16} /></Button></div>
    <p className="text-sm text-muted-foreground">11 geselecteerde leden · Facturen van 15 januari 2026 · Baba, Papillion en Koffie en Dromen uitgesloten</p>
    <p className="text-sm">Afzender: noreply@leden.coffeeshopbond.nl · Antwoorden: info@coffeeshopbond.nl · Secretariaat — Bond van Cannabis Detaillisten</p>
    {query.isPending && <p role="status">Ontvangers laden…</p>}
    {(query.error || error) && <p role="alert" className="text-destructive">{error || 'Ontvangers niet beschikbaar of geen toegang.'}</p>}
    <div className="space-y-0">{query.data?.map(row => <div key={row.id} className="border-b py-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 space-y-1"><p className="font-semibold">{row.shop} <span className="text-muted-foreground text-sm">#{row.member_id} · {row.invoice_number}</span></p><p className="text-sm break-all">{row.name} · {row.email || 'Contactadres ontbreekt'}</p><p className="text-sm text-muted-foreground">{row.blocked && row.status === 'unsent' ? 'Contact controleren / verzending geblokkeerd' : labels[row.status] || row.status}{row.sent_at ? ` · Reactie vóór ${new Date(row.deadline).toLocaleDateString('nl-NL')}` : ''}</p></div>
      <Button variant="outline" size="sm" disabled={sending || row.blocked || row.status !== 'unsent'} onClick={() => setSelected(row)}><Mail size={14} className="mr-2" />Mail bekijken en verzenden</Button>
    </div>)}</div>
    <AlertDialog open={Boolean(selected)} onOpenChange={open => { if (!open && !sending) setSelected(null); }}><AlertDialogContent className="max-h-[85vh] overflow-y-auto"><AlertDialogHeader><AlertDialogTitle>{RECONFIRMATION_SUBJECT}</AlertDialogTitle><AlertDialogDescription>Eén mail aan {selected?.name} ({selected?.email}). De reactietermijn begint bij verzending en duurt 30 dagen.</AlertDialogDescription></AlertDialogHeader>
      {selected && <div className="space-y-3 text-sm">{reconfirmationParagraphs(selected.name, selected.invoice_number, selected.shop).map((p, i) => <div key={i}><p className="whitespace-pre-line">{p}</p>{i === 2 && <p className="font-semibold text-primary mt-3">{RECONFIRMATION_BUTTON}</p>}</div>)}</div>}
      <AlertDialogFooter><AlertDialogCancel disabled={sending}>Annuleren</AlertDialogCancel><Button onClick={send} disabled={sending}>{sending ? 'Verzenden…' : 'Deze ene mail verzenden'}</Button></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </section>;
}