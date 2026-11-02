import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { memberReconfirmation } from '@/lib/memberReconfirmation.functions';

export const Route = createFileRoute('/lidmaatschap-bevestigen')({
  head: () => ({ meta: [{ title: 'Aangesloten blijven — BCD' }, { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: ConfirmMembership,
});

function ConfirmMembership() {
  const [token, setToken] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'confirmed' | 'invalid' | 'error'>('loading');
  const [deadline, setDeadline] = useState('');
  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    if (!/^[a-f0-9]{64}$/.test(t)) { setState('invalid'); return; }
    setToken(t);
    // Fragment is not sent in HTTP requests; never record an answer on page load.
    memberReconfirmation({ data: { token: t, confirm: false } }).then(r => {
      setDeadline(r.deadline || '');
      setState(!r.valid ? 'invalid' : r.confirmed ? 'confirmed' : 'ready');
    }).catch(() => setState('error'));
  }, []);
  async function confirm() {
    if (state !== 'ready') return;
    setState('saving');
    try {
      const r = await memberReconfirmation({ data: { token, confirm: true } });
      setState(r.valid && r.confirmed ? 'confirmed' : 'invalid');
    } catch { setState('error'); }
  }
  return <main className="min-h-screen bg-slate-50 px-5 py-16"><section className="max-w-lg mx-auto rounded-xl border bg-white p-7 space-y-5">
    <p className="text-sm font-semibold text-blue-900">Bond van Cannabis Detaillisten</p>
    <h1 className="text-2xl font-bold">Willen jullie aangesloten blijven?</h1>
    {(state === 'loading' || state === 'saving') && <p role="status">{state === 'saving' ? 'Bevestiging opslaan…' : 'Uitnodiging controleren…'}</p>}
    {state === 'ready' && <><p>We blijven jullie graag betrekken bij de BCD. Met onderstaande knop laat je het secretariaat weten dat jullie aangesloten willen blijven en ledencommunicatie willen ontvangen.</p><p className="text-sm">Reageer uiterlijk {new Date(deadline).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', year: 'numeric' })}.</p><button className="rounded-md bg-blue-900 px-5 py-3 text-white font-semibold w-full" onClick={confirm}>Ja, wij blijven aangesloten</button><p className="text-sm text-slate-600">Dit is geen betaalbevestiging. Een eventuele openstaande factuur blijft afzonderlijk in behandeling.</p></>}
    {state === 'confirmed' && <div role="status"><h2 className="font-semibold text-green-800">Bedankt, jullie bevestiging is ontvangen.</h2><p className="mt-2">Het secretariaat heeft jullie keuze vastgelegd. Jullie blijven ledencommunicatie ontvangen.</p></div>}
    {state === 'invalid' && <p>Deze link is niet geldig of de reactietermijn is verstreken. Neem gerust contact op met het secretariaat.</p>}
    {state === 'error' && <div role="alert"><p>We kunnen jullie bevestiging nu niet controleren. Vernieuw deze pagina om opnieuw te proberen, of mail het secretariaat zodat we jullie kunnen helpen.</p></div>}
    <p className="text-sm">Klopt er iets niet, is er een nieuwe contactpersoon of willen jullie stoppen? Mail <a className="underline" href="mailto:info@coffeeshopbond.nl">info@coffeeshopbond.nl</a>.</p>
  </section></main>;
}
