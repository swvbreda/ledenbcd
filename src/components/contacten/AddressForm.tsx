import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addressCategories, categoryLabel, cleanFields, safeWebsite } from '@/lib/addressBook';

export const organizationFields = [ ['name', 'Naam', 'text'], ['abbreviation', 'Afkorting', 'text'], ['email', 'Algemeen e-mailadres', 'email'], ['phone', 'Telefoon', 'tel'], ['website', 'Website', 'text'], ['address', 'Adres', 'text'], ['postal_code', 'Postcode', 'text'], ['city', 'Plaats', 'text'] ] as const;
export const contactFields = [ ['name', 'Naam', 'text'], ['position', 'Functie', 'text'], ['department', 'Afdeling of fractie', 'text'], ['email', 'E-mailadres', 'email'], ['phone', 'Telefoon', 'tel'] ] as const;
export function AddressForm({ title, initial, organization, onSave, onClose }: {
  title: string; initial: Record<string, string>; organization: boolean;
  onSave: (values: Record<string, string>) => Promise<void>; onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const keys = [...(organization ? organizationFields : contactFields).map(([key]) => key), 'note', ...(organization ? ['category'] : [])];
    return Object.fromEntries(keys.map(key => [key, initial[key] ?? '']));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const cleaned = cleanFields(values);
    if (!cleaned.name) { setError('Vul een naam in.'); return; }
    if (organization && cleaned.website && !safeWebsite(cleaned.website)) { setError('Vul een geldige http- of https-website in.'); return; }
    setSaving(true); setError('');
    try { await onSave(cleaned); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Opslaan mislukt.'); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[85dvh] overflow-y-auto rounded-lg p-4 sm:p-6"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Alleen naam is verplicht.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="min-w-0 space-y-4"><div className="grid min-w-0 gap-4 sm:grid-cols-2">{(organization ? organizationFields : contactFields).map(([key, label, type]) => <div key={key} className="min-w-0 space-y-1"><Label htmlFor={`address-${key}`}>{label}{key === 'name' ? ' *' : ''}</Label><Input id={`address-${key}`} type={type} value={values[key] ?? ''} onChange={e => set(key, e.target.value)} required={key === 'name'} maxLength={key === 'name' ? 200 : 300} disabled={saving} autoComplete="off" /></div>)}{organization && <div className="space-y-1"><Label htmlFor="address-category">Categorie</Label><select id="address-category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={values.category} disabled={saving} onChange={e => set('category', e.target.value)}>{addressCategories.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>}</div>
    <div className="space-y-1"><Label htmlFor="address-note">Korte notitie</Label><Textarea id="address-note" value={values.note ?? ''} onChange={e => set('note', e.target.value)} maxLength={2000} disabled={saving} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Annuleren</Button><Button type="submit" disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</Button></div></form>
  </DialogContent></Dialog>;
}
