import { Suspense, useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowLeft, Building2, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { addressCategories, categoryLabel, contactRole, contactRoles, canManageAddressBook, emptyContact, emptyOrganization, searchAddressBook, visibleNote, groupByCategory, plural, type OrganizationInput, type ContactInput } from '@/lib/addressBook';
import { addressBookQuery, deleteAddressRecord, saveAddressRecord } from '@/lib/addressBookClient';
import { AddressForm } from './AddressForm';
import { GeneralLinks } from './ContactLinks';
import { ContactTable } from './ContactTable';
import { OrganizationTable } from './OrganizationTable';
import { ParliamentContactGroups } from './ParliamentContactGroups';
import type { ParliamentGrouping } from '@/lib/addressBookParliament';
import { ExportToolbar } from './ExportToolbar';
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
  const [parliamentGrouping, setParliamentGrouping] = useState<ParliamentGrouping>('party');
  const org = id ? data.organizations.find(o => o.id === id) : null;
  const contacts = data.contacts.filter(c => c.organization_id === id).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const results = searchAddressBook(data, query, category, role);
  const scope = org ? { organizations: [org], contacts } : results;
  const selectionContext = JSON.stringify([userId, id, query, category, role]);
  const [selection, setSelection] = useState<{ context: string; ids: Set<string> }>({ context: selectionContext, ids: new Set() });
  // Permanently discard previous-context choices; the synchronous guard below protects the render before this effect.
  useEffect(() => { setSelection({ context: selectionContext, ids: new Set() }); }, [selectionContext]);
  const selected = new Set(scope.contacts.filter(c => selection.context === selectionContext && selection.ids.has(c.id)).map(c => c.id));
  const select = (ids: string[], checked: boolean) => setSelection(() => { const next = new Set(selected); for (const cid of ids) { if (checked) next.add(cid); else next.delete(cid); } return { context: selectionContext, ids: next }; });
  const clearSelection = () => setSelection({ context: selectionContext, ids: new Set() });
  const setFilter = (next: Filters) => onSearch?.({ q: query || undefined, category: category || undefined, role: role || undefined, ...next });
  const categoryCount = (c: string) => data.organizations.filter(o => o.category === c).length;
  const roleCount = (r: string) => data.contacts.filter(c => { const oc = data.organizations.find(o => o.id === c.organization_id)?.category ?? ''; return contactRole(c, oc) === r && (!category || oc === category); }).length;
  const active = !!(query.trim() || category || role);
  const groups = groupByCategory(results.organizations);
  const byOrg = new Map<string, typeof results.contacts>();
  for (const c of results.contacts) byOrg.set(c.organization_id, [...(byOrg.get(c.organization_id) ?? []), c]);
  const groupKey = groups.map(g => g.category).join('|');
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Filters open the matching groups; clearing them collapses everything again.
  useEffect(() => { setOpen(active ? new Set(groupKey.split('|').filter(Boolean)) : new Set()); }, [active, query, category, role, groupKey]);
  const toggle = (c: string) => setOpen(prev => { const next = new Set(prev); if (next.has(c)) next.delete(c); else next.add(c); return next; });
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
    <header className="space-y-1"><h1 className="break-words font-display text-2xl sm:text-3xl">{org ? org.name : 'Contacten'}</h1><p className="text-sm text-muted-foreground">{org ? [org.abbreviation, categoryLabel(org.category)].filter(Boolean).join(' · ') : `${data.organizations.length} organisaties · ${data.contacts.length} contactpersonen`}</p></header>
    {refreshError && <div role="alert" className="space-y-2"><p>{refreshError}</p><Button onClick={refresh} variant="outline">Opnieuw laden</Button></div>}
    {org ? <>
      <div className="flex flex-wrap items-center justify-between gap-2"><Button asChild variant="outline"><Link to="/contacten"><ArrowLeft size={16} /> Contacten</Link></Button><div className="flex gap-2"><Button variant="outline" onClick={() => setEdit({ kind: 'organization', id: org.id, values: { ...org } })}><Pencil size={16} /> Bewerken</Button><Button variant="outline" size="icon" aria-label="Organisatie verwijderen" title="Organisatie verwijderen" onClick={() => askRemove({ kind: 'organization', id: org.id, name: org.name, count: contacts.length })}><Trash2 size={16} /></Button></div></div>
      <section aria-label="Organisatiegegevens" className="space-y-2"><h2 className="font-display text-lg">Algemene gegevens</h2><div className="max-w-full overflow-x-auto"><table className="w-full border-collapse text-sm"><tbody><tr><th scope="row" className="w-32 border border-border bg-muted px-2 py-2 text-left">Contact</th><td className="border border-border px-2 py-2"><GeneralLinks email={org.email} phone={org.phone} website={org.website} /></td></tr><tr><th scope="row" className="border border-border bg-muted px-2 py-2 text-left">Adres</th><td className="border border-border px-2 py-2 break-words">{[org.address, org.postal_code, org.city].filter(Boolean).join(' ') || '–'}</td></tr>{visibleNote(org.note) && <tr><th scope="row" className="border border-border bg-muted px-2 py-2 text-left">Notitie</th><td className="border border-border px-2 py-2"><details><summary className="cursor-pointer text-sm">Notitie bekijken</summary><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{visibleNote(org.note)}</p></details></td></tr>}</tbody></table></div></section>
      <ExportToolbar key={selectionContext} results={scope} selected={selected} onClear={clearSelection} />
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl">Contactpersonen ({contacts.length})</h2><Button onClick={() => setEdit({ kind: 'contact', values: { ...emptyContact } })}><Plus size={16} /> Contactpersoon toevoegen</Button></div>
      <ContactTable label={`Contactpersonen van ${org.name}`} category={org.category} contacts={contacts} selected={selected} onSelection={select} onEdit={c => setEdit({ kind: 'contact', id: c.id, values: { ...c } })} onDelete={c => askRemove({ kind: 'contact', id: c.id, name: c.name, count: 0 })} /></section>
    </> : <>
      <ExportToolbar key={selectionContext} results={scope} selected={selected} onClear={clearSelection} primaryAction={<Button onClick={addOrg}><Plus size={16} /> Organisatie toevoegen</Button>} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(16rem,1fr)_minmax(0,14rem)_minmax(0,14rem)]"><div className="relative min-w-0 md:col-span-2 2xl:col-span-1"><Search aria-hidden size={17} className="absolute left-3 top-3 text-muted-foreground" /><Input aria-label="Zoek contacten" placeholder="Zoek organisatie, persoon, functie of e-mail…" className="pl-10" value={query} onChange={e => setFilter({ q: e.target.value || undefined })} /></div><select aria-label="Categorie" className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={e => setFilter({ category: e.target.value || undefined })}><option value="">Alle categorieën ({data.organizations.length})</option>{addressCategories.map(c => <option key={c} value={c}>{categoryLabel(c)} ({categoryCount(c)})</option>)}</select><select aria-label="Functie" className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={role} onChange={e => setFilter({ role: e.target.value || undefined })}><option value="">Alle functies</option>{contactRoles.map(r => <option key={r} value={r}>{r} ({roleCount(r)})</option>)}</select></div>
      {active && <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Actieve filters"><span className="text-muted-foreground">{plural(results.contacts.length, 'contactpersoon', 'contactpersonen')} · {plural(results.organizations.length, 'organisatie', 'organisaties')}</span>{category && <span className="rounded-full border border-primary px-2 py-0.5">{categoryLabel(category)}</span>}{role && <span className="rounded-full border border-primary px-2 py-0.5">{role}</span>}<Button variant="ghost" size="sm" onClick={() => onSearch?.({})}><X size={14} /> Filters wissen</Button></div>}
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-display text-lg"><Building2 size={18} className="text-brand-red" /> Organisaties ({results.organizations.length})</h2>{!results.organizations.length && <p className="py-8 text-muted-foreground">{data.organizations.length ? 'Geen organisaties gevonden.' : 'Nog geen organisaties.'}</p>}
      <div className="space-y-2">{groups.map(g => { const isOpen = open.has(g.category); const panel = `categorie-${g.category.replace(/\W+/g, '-')}`; const count = g.items.reduce((n, o) => n + (byOrg.get(o.id)?.length ?? 0), 0); return <section key={g.category} className="overflow-hidden rounded-md border border-border"><button type="button" aria-expanded={isOpen} aria-controls={panel} onClick={() => toggle(g.category)} className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 bg-muted/30 px-4 py-2.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto_auto]"><span className="min-w-0 break-words font-display text-base">{categoryLabel(g.category)}</span><span className="col-start-1 row-start-2 min-w-0 text-sm tabular-nums text-muted-foreground sm:col-start-2 sm:row-start-1 sm:text-right">{plural(g.items.length, 'organisatie', 'organisaties')} · {plural(count, 'contactpersoon', 'contactpersonen')}</span><ChevronDown size={18} aria-hidden className={`col-start-2 row-start-1 text-brand-red transition-transform sm:col-start-3 ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen && <div id={panel} className="min-w-0 border-t border-border">{g.category === 'Tweede Kamer' ? <ParliamentContactGroups key={selectionContext} label={categoryLabel(g.category)} organizations={g.items} contacts={g.items.flatMap(o => byOrg.get(o.id) ?? [])} mode={parliamentGrouping} onModeChange={setParliamentGrouping} selected={selected} onSelection={select} query={query} expandMatches={!!(query.trim() || role)} /> : g.category === 'Ministerie' ? <OrganizationTable key={selectionContext} label={categoryLabel(g.category)} organizations={g.items} contacts={g.items.flatMap(o => byOrg.get(o.id) ?? [])} selected={selected} onSelection={select} expandContacts={!!(query.trim() || role)} /> : <ContactTable label={`Contactpersonen: ${categoryLabel(g.category)}`} organizations={g.items} contacts={g.items.flatMap(o => byOrg.get(o.id) ?? [])} selected={selected} onSelection={select} />}</div>}</section>; })}</div></section>
    </>}
    {edit && <AddressForm key={`${edit.kind}:${edit.id ?? 'new'}`} title={edit.kind === 'organization' ? (edit.id ? 'Organisatie bewerken' : 'Organisatie toevoegen') : (edit.id ? 'Contactpersoon bewerken' : 'Contactpersoon toevoegen')} initial={edit.values} organization={edit.kind === 'organization'} category={org?.category} onSave={save} onClose={() => setEdit(null)} />}
    {removal && <Dialog open onOpenChange={open => { if (!open && !removing) setRemoval(null); }}><DialogContent className="w-[calc(100%-2rem)] rounded-lg max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{removal.kind === 'organization' ? 'Organisatie verwijderen' : 'Contactpersoon verwijderen'}</DialogTitle><DialogDescription className="break-words">{removal.kind === 'organization' ? `“${removal.name}” en alle ${removal.count} onderliggende contactpersonen worden definitief verwijderd uit Contacten.` : `“${removal.name}” wordt definitief verwijderd uit Contacten.`}</DialogDescription></DialogHeader>{removeError && <p role="alert" className="text-destructive text-sm">{removeError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={removing} onClick={() => setRemoval(null)}>Annuleren</Button><Button variant="destructive" disabled={removing} onClick={remove}>{removing ? 'Verwijderen…' : 'Definitief verwijderen'}</Button></div></DialogContent></Dialog>}
  </div>;
}


