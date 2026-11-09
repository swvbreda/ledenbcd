import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addressCategories, categoryLabel, cleanFields, safeWebsite, isParliament } from '@/lib/addressBook';

export const organizationFields = [ ['name', 'Naam', 'text'], ['abbreviation', 'Afkorting', 'text'], ['email', 'Algemeen e-mailadres', 'email'], ['phone', 'Telefoon', 'tel'], ['website', 'Website', 'text'], ['address', 'Adres', 'text'], ['postal_code', 'Postcode', 'text'], ['city', 'Plaats', 'text'] ] as const;
export const contactFields = [ ['name', 'Naam', 'text'], ['position', 'Functie', 'text'], ['department', 'Afdeling of fractie', 'text'], ['email', 'E-mailadres', 'email'], ['phone', 'Telefoon', 'tel'] ] as const;
const parliamentaryKeys = ['party', 'committees', 'policy_areas'] as const;
export function AddressForm({ title, initial, organization, category = '', onSave, onClose }: {
  title: string; initial: Record<string, string>; organization: boolean; category?: string;
  onSave: (values: Record<string, string>) => Promise<void>; onClose: () => void;
}) {
  const parliamentary = !organization && isParliament(category);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const keys = [...(organization ? organizationFields : contactFields).map(([key]) => key), 'note', ...(organization ? ['category'] : ['party', 'committees', 'policy_areas'])];
    return Object.fromEntries(keys.map(key => [key, initial[key] ?? '']));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const set = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setChangedFields(prev => new Set([...prev, key]));
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const cleaned = cleanFields(values);
    // An older cached row may not contain the added fields yet. An unrelated edit
    // must not clear parliamentary information already added on the server.
    if (!organization) for (const key of parliamentaryKeys) {
      if (initial[key] === undefined && !changedFields.has(key)) delete cleaned[key];
    }
    if (!cleaned.name) { setError('Vul een naam in.'); return; }
    if (organization && cleaned.website && !safeWebsite(cleaned.website)) { setError('Vul een geldige http- of https-website in.'); return; }
    setSaving(true); setError('');
    try { await onSave(cleaned); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Opslaan mislukt.'); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[85dvh] overflow-y-auto rounded-lg p-4 sm:p-6"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Alleen naam is verplicht.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="min-w-0 space-y-4"><div className="grid min-w-0 gap-4 sm:grid-cols-2">{(organization ? organizationFields : contactFields).map(([key, label, type]) => <div key={key} className="min-w-0 space-y-1"><Label htmlFor={`address-${key}`}>{label}{key === 'name' ? ' *' : ''}</Label><Input id={`address-${key}`} type={type} value={values[key] ?? ''} onChange={e => set(key, e.target.value)} required={key === 'name'} maxLength={key === 'name' ? 200 : 300} disabled={saving} autoComplete="off" /></div>)}{organization && <div className="space-y-1"><Label htmlFor="address-category">Categorie</Label><select id="address-category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={values.category} disabled={saving} onChange={e => set('category', e.target.value)}>{addressCategories.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>}</div>
    {parliamentary && <fieldset className="min-w-0 space-y-4 border-t border-border pt-4"><legend className="px-1 text-sm font-semibold">Parlementaire gegevens</legend>
      <div className="space-y-1"><Label htmlFor="address-party">Partij / fractie</Label><Input id="address-party" value={values.party ?? ''} onChange={e => set('party', e.target.value)} maxLength={200} disabled={saving} autoComplete="off" /></div>
      <div className="space-y-1"><Label htmlFor="address-committees">Commissies en rol</Label><Textarea id="address-committees" value={values.committees ?? ''} onChange={e => set('committees', e.target.value)} maxLength={6000} disabled={saving} placeholder="Eén commissie per regel, met lid, vervangend lid of voorzitter" /></div>
      <div className="space-y-1"><Label htmlFor="address-policy_areas">Beleidsterreinen medewerker</Label><Textarea id="address-policy_areas" value={values.policy_areas ?? ''} onChange={e => set('policy_areas', e.target.value)} maxLength={6000} disabled={saving} placeholder="Eén beleidsterrein per regel" /></div>
    </fieldset>}
    <div className="space-y-1"><Label htmlFor="address-note">Korte notitie</Label><Textarea id="address-note" value={values.note ?? ''} onChange={e => set('note', e.target.value)} maxLength={2000} disabled={saving} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Annuleren</Button><Button type="submit" disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</Button></div></form>
  </DialogContent></Dialog>;
}

