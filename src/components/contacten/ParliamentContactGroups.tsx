import { useEffect, useId, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { plural, type Contact, type Organization } from '@/lib/addressBook';
import { groupParliamentContacts, type ParliamentGrouping } from '@/lib/addressBookParliament';
import { GeneralLinks } from './ContactLinks';
import { ContactTable } from './ContactTable';

/** Grouping changes presentation only; selection and export keep the canonical contact IDs. */
export function ParliamentContactGroups({ organizations, contacts, label, mode, onModeChange, selected, onSelection, query = '', expandMatches = false }: {
  organizations: Organization[];
  contacts: Contact[];
  label: string;
  mode: ParliamentGrouping;
  onModeChange: (mode: ParliamentGrouping) => void;
  selected: ReadonlySet<string>;
  onSelection: (ids: string[], checked: boolean) => void;
  query?: string;
  expandMatches?: boolean;
}) {
  const prefix = useId();
  const groups = groupParliamentContacts(contacts, mode);
  const groupKey = JSON.stringify(groups.map(group => [group.key, group.label, group.contacts.map(contact => contact.id)]));
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    const available = JSON.parse(groupKey) as [string, string, string[]][];
    const needle = query.trim().toLocaleLowerCase('nl');
    const matchingNames = needle ? available.filter(([, name]) => name.toLocaleLowerCase('nl').includes(needle)) : [];
    const expanded = new Set(expandMatches ? (matchingNames.length ? matchingNames : available).map(([key]) => key) : []);
    if (expandMatches && matchingNames.length) {
      const visible = new Set(matchingNames.flatMap(([, , contactIds]) => contactIds));
      // A search may also match a person's name, function or policy area outside the named groups.
      for (const [key, , contactIds] of available) {
        if (contactIds.some(id => !visible.has(id))) {
          expanded.add(key);
          contactIds.forEach(id => visible.add(id));
        }
      }
    }
    setOpen(expanded);
  }, [mode, query, expandMatches, groupKey]);
  const ids = [...new Set(contacts.map(contact => contact.id))];
  const chosen = ids.filter(id => selected.has(id)).length;
  const toggle = (key: string) => setOpen(previous => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return <div className="min-w-0 max-w-full">
    <div className="space-y-2 border-b border-border px-3 py-3 sm:px-4">
      {organizations.map(organization => <div key={organization.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <Link to="/contacten/$id" params={{ id: organization.id }} className="text-primary underline underline-offset-2">{organization.name}</Link>
        <GeneralLinks email={organization.email} phone={organization.phone} website={organization.website} />
      </div>)}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${label} indelen`}>
          <span className="mr-2 text-sm text-muted-foreground">Indelen</span>
          <Button size="sm" variant={mode === 'party' ? 'default' : 'outline'} aria-pressed={mode === 'party'} onClick={() => onModeChange('party')}>Per partij</Button>
          <Button size="sm" variant={mode === 'committee' ? 'default' : 'outline'} aria-pressed={mode === 'committee'} onClick={() => onModeChange('committee')}>Per commissie</Button>
        </div>
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <Checkbox className="h-5 w-5" aria-label={`Selecteer alle contactpersonen van ${label}`} disabled={!ids.length} checked={chosen === ids.length && ids.length > 0 ? true : chosen > 0 ? 'indeterminate' : false} onCheckedChange={value => onSelection(ids, value === true)} />
          Alle {plural(ids.length, 'contactpersoon', 'contactpersonen')} selecteren
        </label>
      </div>
      {mode === 'committee' && <p className="text-xs text-muted-foreground">Commissies en contactgroepen. Contactpersonen kunnen in meerdere groepen staan; e-mailadressen worden één keer geëxporteerd.</p>}
    </div>

    {!groups.length && <p className="px-4 py-3 text-sm text-muted-foreground">Geen contactpersonen.</p>}
    <div className="divide-y divide-border">{groups.map((group, index) => {
      const groupIds = group.contacts.map(contact => contact.id);
      const selectedCount = groupIds.filter(id => selected.has(id)).length;
      const expanded = open.has(group.key);
      const panel = `${prefix}-${mode}-${index}`;
      return <section key={group.key}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 bg-muted/20 px-3 sm:px-4">
          <Checkbox className="h-5 w-5" aria-label={`Selecteer alle contactpersonen in ${group.label}`} checked={selectedCount === groupIds.length ? true : selectedCount > 0 ? 'indeterminate' : false} onCheckedChange={value => onSelection(groupIds, value === true)} />
          <h3 className="min-w-0">
            <button type="button" aria-expanded={expanded} aria-controls={panel} onClick={() => toggle(group.key)} className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <span className="min-w-0 break-words font-display text-base">{group.label}</span>
              <span className="col-start-1 row-start-2 text-sm font-normal tabular-nums text-muted-foreground sm:col-start-2 sm:row-start-1">{plural(group.contacts.length, 'contactpersoon', 'contactpersonen')}</span>
              <ChevronDown size={18} aria-hidden className={`col-start-2 row-start-1 text-primary transition-transform sm:col-start-3 ${expanded ? '' : '-rotate-90'}`} />
            </button>
          </h3>
        </div>
        {expanded && <div id={panel} className="min-w-0 border-t border-border">
          <ContactTable label={`${label} — ${mode === 'party' ? 'partij' : 'commissie'} ${group.label}`} category={organizations[0]?.category ?? 'Tweede Kamer'} contacts={group.contacts} committee={mode === 'committee' && !group.unassigned ? group.label : undefined} selected={selected} onSelection={onSelection} />
        </div>}
      </section>;
    })}</div>
  </div>;
}
