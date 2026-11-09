import { Suspense, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowLeft, Building2, UserRound, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import BcdHeroBanner from '@/components/BcdHeroBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { addressCategories, categoryLabel, contactRole, contactRoles, canManageAddressBook, emptyContact, emptyOrganization, searchAddressBook, type OrganizationInput, type ContactInput } from '@/lib/addressBook';
import { addressBookQuery, deleteAddressRecord, saveAddressRecord } from '@/lib/addressBookClient';
import { AddressForm } from './AddressForm';
import { GeneralLinks } from './ContactLinks';
import { ErrorBoundary } from './AddressErrorBoundary';

type Filters = { q?: string; category?: string; role?: string };
type Edit = { kind: 'organization' | 'contact'; id?: string; values: Record<string, string> };
type Removal = { kind: 'organization' | 'contact'; id: string; name: string; count: number };
export default function AddressBookPage({ id, query = '', category = '', role = '', onSearch }: { id?: string; query?: string; category?: string; role?: string; onSearch?: (values: Filters) => void }) {
  const auth = useAuth();
  if (auth.loading) return <div className="p-6" role="status">Contacten laden…</div>;
  if (!canManageAddressBook(auth) || !auth.user) return <div className="p-6" role="alert">Je hebt geen toegang tot Contacten.</div>;
  return <ErrorBoundary key={`${auth.user.id}:${id ?? 'index'}`}><Suspense fallback={<div className="p-6" role="status">Contacten laden…</div>}><Content id={id} userId={auth.user.id} query={query} category={category} role={role} onSearch={onSearch} /></Suspense></ErrorBoundary>;
}
function Content({ id, userId, query, category, role, onSearch }: { id?: string; userId: string; query: string; category: string; role: string; onSearch?: (values: Filters) => void }) {
  const { data } = useSuspenseQuery(addressBookQuery(userId));
  const client = useQueryClient();
  const navigate = useNavigate();
  const [edit, setEdit] = useState<Edit | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const org = id ? data.organizations.find(o => o.id === id) : null;
  const contacts = data.contacts.filter(c => c.organization_id === id).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const results = searchAddressBook(data, query, category, role);
  const setFilter = (next: Filters) => onSearch?.({ q: query || undefined, category: category || undefined, role: role || undefined, ...next });
  const categoryCount = (c: string) => data.organizations.filter(o => o.category === c).length;
  const roleCount = (r: string) => data.contacts.filter(c => contactRole(c) === r && (!category || data.organizations.find(o => o.id === c.organization_id)?.category === category)).length;
  const active = !!(query.trim() || category || role);
  async function refresh() {
    // Do not leave stale rows on screen after a successful database mutation.
    try { const fresh = await client.fetchQuery(addressBookQuery(userId)); client.setQueryData(addressBookQuery(userId).queryKey, fresh); setRefreshError(''); }
    catch { client.removeQueries({ queryKey: addressBookQuery(userId).queryKey }); setRefreshError('Opgeslagen wijzigingen konden niet opnieuw worden geladen.'); }
  }
  async function save(values: Record<string, string>) {
    if (!edit) return;
    const newId = await saveAddressRecord(edit.kind === 'organization' ? 'address_book_organizations' : 'address_book_contacts', edit.kind === 'organization' ? values as OrganizationInput : { ...values, organization_id: id ?? '' } as ContactInput, edit.id);
    await refresh();
    toast.success('Opgeslagen');
    if (edit.kind === 'organization' && !edit.id) await navigate({ to: '/contacten/$id', params: { id: newId } });
  }
  async function remove() {
    if (!removal || removing) return;
    setRemoving(true); setRemoveError('');
    try {
      await deleteAddressRecord(removal.kind === 'organization' ? 'address_book_organizations' : 'address_book_contacts', removal.id);
      await refresh(); setRemoval(null); toast.success('Verwijderd');
      if (removal.kind === 'organization') await navigate({ to: '/contacten' });
    } catch (e) { setRemoveError(e instanceof Error ? e.message : 'Verwijderen mislukt.'); }
    finally { setRemoving(false); }
  }
  const addOrg = () => setEdit({ kind: 'organization', values: { ...emptyOrganization } });
  const askRemove = (value: Removal) => { setRemoveError(''); setRemoval(value); };
  if (id && !org) return <div className="p-4 sm:p-6 space-y-4"><h1 className="font-display text-2xl">Organisatie niet gevonden</h1><p>Deze organisatie bestaat niet meer of is niet toegankelijk.</p><Button asChild variant="outline"><Link to="/contacten"><ArrowLeft size={16} /> Contacten</Link></Button></div>;
  return <div className="min-w-0 max-w-full space-y-5 p-4 sm:p-6 overflow-x-hidden">
    <BcdHeroBanner title={org ? org.name : 'Contacten'} subtitle={org ? [org.abbreviation, categoryLabel(org.category)].filter(Boolean).join(' · ') : `${data.organizations.length} organisaties · ${data.contacts.length} contactpersonen`} />
    {refreshError && <div role="alert" className="space-y-2"><p>{refreshError}</p><Button onClick={refresh} variant="outline">Opnieuw laden</Button></div>}
    {org ? <>
      <div className="flex flex-wrap items-center justify-between gap-2"><Button asChild variant="outline"><Link to="/contacten"><ArrowLeft size={16} /> Contacten</Link></Button><div className="flex gap-2"><Button variant="outline" onClick={() => setEdit({ kind: 'organization', id: org.id, values: { ...org } })}><Pencil size={16} /> Bewerken</Button><Button variant="outline" size="icon" aria-label="Organisatie verwijderen" title="Organisatie verwijderen" onClick={() => askRemove({ kind: 'organization', id: org.id, name: org.name, count: contacts.length })}><Trash2 size={16} /></Button></div></div>
      <section aria-label="Organisatiegegevens" className="space-y-3 border-b border-border pb-5"><h2 className="font-display text-lg">Algemene gegevens</h2><GeneralLinks email={org.email} phone={org.phone} website={org.website} />{(org.address || org.postal_code || org.city) && <p className="break-words text-sm">{org.address}<br />{[org.postal_code, org.city].filter(Boolean).join(' ')}</p>}{org.note && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{org.note}</p>}</section>
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl">Contactpersonen ({contacts.length})</h2><Button onClick={() => setEdit({ kind: 'contact', values: { ...emptyContact } })}><Plus size={16} /> Contactpersoon toevoegen</Button></div>
      {!contacts.length && <p className="py-6 text-muted-foreground">Nog geen contactpersonen.</p>}<div className="grid gap-3 md:grid-cols-2">{contacts.map(c => <article id={`persoon-${c.id}`} key={c.id} className="min-w-0 rounded-lg border-2 border-primary/60 p-4 space-y-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{c.name}</h3><p className="break-words text-sm text-muted-foreground">{[c.position, c.department].filter(Boolean).join(' · ')}</p></div><div className="flex shrink-0"><Button size="icon" variant="ghost" title="Contactpersoon bewerken" aria-label={`Bewerk ${c.name}`} onClick={() => setEdit({ kind: 'contact', id: c.id, values: { ...c } })}><Pencil size={16} /></Button><Button size="icon" variant="ghost" title="Contactpersoon verwijderen" aria-label={`Verwijder ${c.name}`} onClick={() => askRemove({ kind: 'contact', id: c.id, name: c.name, count: 0 })}><Trash2 size={16} /></Button></div></div><GeneralLinks email={c.email} phone={c.phone} />{c.note && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{c.note}</p>}</article>)}</div></section>
    </> : <>
      <div className="flex flex-wrap justify-end"><Button onClick={addOrg}><Plus size={16} /> Organisatie toevoegen</Button></div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_14rem]"><div className="relative min-w-0"><Search aria-hidden size={17} className="absolute left-3 top-3 text-muted-foreground" /><Input aria-label="Zoek contacten" placeholder="Zoek organisatie, persoon, functie of e-mail…" className="pl-10" value={query} onChange={e => setFilter({ q: e.target.value || undefined })} /></div><select aria-label="Categorie" className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={e => setFilter({ category: e.target.value || undefined })}><option value="">Alle categorieën ({data.organizations.length})</option>{addressCategories.map(c => <option key={c} value={c}>{categoryLabel(c)} ({categoryCount(c)})</option>)}</select><select aria-label="Functie" className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={role} onChange={e => setFilter({ role: e.target.value || undefined })}><option value="">Alle functies</option>{contactRoles.map(r => <option key={r} value={r}>{r} ({roleCount(r)})</option>)}</select></div>
      {active && <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Actieve filters"><span className="text-muted-foreground">{results.contacts.length} contactpersonen · {results.organizations.length} organisaties</span>{category && <span className="rounded-full border border-primary px-2 py-0.5">{categoryLabel(category)}</span>}{role && <span className="rounded-full border border-primary px-2 py-0.5">{role}</span>}<Button variant="ghost" size="sm" onClick={() => onSearch?.({})}><X size={14} /> Filters wissen</Button></div>}
      {(query.trim() || role) && <section className="space-y-3"><h2 className="flex items-center gap-2 font-display text-lg"><UserRound size={18} className="text-brand-red" /> Contactpersonen ({results.contacts.length})</h2>{!results.contacts.length && <p className="text-sm text-muted-foreground">Geen passende contactpersonen.</p>}<div className="grid gap-3 md:grid-cols-2">{results.contacts.map(c => { const organization = data.organizations.find(o => o.id === c.organization_id); return <article key={c.id} className="min-w-0 rounded-lg border-2 border-primary/60 p-4"><Link to="/contacten/$id" params={{ id: c.organization_id }} hash={`persoon-${c.id}`} className="break-words font-semibold text-primary underline">{c.name}</Link><p className="break-words text-sm">{[c.position || 'Functie onbekend', c.department].filter(Boolean).join(' · ')}</p><p className="break-words text-sm text-muted-foreground">{organization?.name}</p><GeneralLinks email={c.email} phone={c.phone} /></article>; })}</div></section>}
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-display text-lg"><Building2 size={18} className="text-brand-red" /> Organisaties ({results.organizations.length})</h2>{!results.organizations.length && <p className="py-8 text-muted-foreground">{data.organizations.length ? 'Geen organisaties gevonden.' : 'Nog geen organisaties.'}</p>}
      <div className="divide-y divide-border border-y border-border">{results.organizations.map(o => <article key={o.id} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div className="min-w-0"><Link to="/contacten/$id" params={{ id: o.id }} className="break-words text-lg font-semibold text-primary underline underline-offset-2">{o.name}</Link><p className="break-words text-sm text-muted-foreground">{[o.abbreviation, categoryLabel(o.category), o.city].filter(Boolean).join(' · ')}</p><p className="text-sm">{data.contacts.filter(c => c.organization_id === o.id).length} contactpersonen</p></div><GeneralLinks email={o.email} phone={o.phone} website={o.website} /></article>)}</div></section>
    </>}
    {edit && <AddressForm key={`${edit.kind}:${edit.id ?? 'new'}`} title={edit.kind === 'organization' ? (edit.id ? 'Organisatie bewerken' : 'Organisatie toevoegen') : (edit.id ? 'Contactpersoon bewerken' : 'Contactpersoon toevoegen')} initial={edit.values} organization={edit.kind === 'organization'} onSave={save} onClose={() => setEdit(null)} />}
    {removal && <Dialog open onOpenChange={open => { if (!open && !removing) setRemoval(null); }}><DialogContent className="w-[calc(100%-2rem)] rounded-lg max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{removal.kind === 'organization' ? 'Organisatie verwijderen' : 'Contactpersoon verwijderen'}</DialogTitle><DialogDescription className="break-words">{removal.kind === 'organization' ? `“${removal.name}” en alle ${removal.count} onderliggende contactpersonen worden definitief verwijderd uit Contacten.` : `“${removal.name}” wordt definitief verwijderd uit Contacten.`}</DialogDescription></DialogHeader>{removeError && <p role="alert" className="text-destructive text-sm">{removeError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={removing} onClick={() => setRemoval(null)}>Annuleren</Button><Button variant="destructive" disabled={removing} onClick={remove}>{removing ? 'Verwijderen…' : 'Definitief verwijderen'}</Button></div></DialogContent></Dialog>}
  </div>;
}
