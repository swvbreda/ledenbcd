import { Fragment, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { plural, safeWebsite, visibleNote, type Contact, type Organization } from '@/lib/addressBook';
import { EmailLink } from './ContactLinks';
import { ContactTable } from './ContactTable';

const cell = 'border border-border px-2 py-2';
const dash = <span className="text-muted-foreground" aria-label="leeg">–</span>;

/** Organization details remain visible; expansion never changes the export or selection scope. */
export function OrganizationTable({ organizations, contacts, label, selected, onSelection, expandContacts = false }: {
  organizations: Organization[];
  contacts: Contact[];
  label: string;
  selected: ReadonlySet<string>;
  onSelection: (ids: string[], checked: boolean) => void;
  expandContacts?: boolean;
}) {
  // The caller keys this component by the filter context so fresh person searches open their matches.
  const [open, setOpen] = useState(() => new Set(expandContacts ? organizations.map(o => o.id) : []));
  const byOrganization = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const people = byOrganization.get(contact.organization_id) ?? [];
    people.push(contact);
    byOrganization.set(contact.organization_id, people);
  }
  const ids = organizations.flatMap(o => (byOrganization.get(o.id) ?? []).map(c => c.id));
  const checked = ids.filter(id => selected.has(id)).length;
  const toggle = (id: string) => setOpen(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <div className="min-w-0 max-w-full overflow-x-auto" tabIndex={0} aria-label={`${label} — horizontaal scrollbaar`}>
    <table className="w-full min-w-[64rem] border-collapse text-sm" aria-label={`${label}: algemene gegevens`}>
      <thead className="bg-muted text-left text-xs text-muted-foreground"><tr>
        <th scope="col" className={`${cell} w-10`}><Checkbox className="h-5 w-5" aria-label={`Alle contactpersonen selecteren: ${label}`} disabled={!ids.length} checked={checked === ids.length && ids.length > 0 ? true : checked > 0 ? 'indeterminate' : false} onCheckedChange={value => onSelection(ids, value === true)} /></th>
        {['Organisatie', 'Algemeen e-mailadres', 'Telefoon', 'Website', 'Adres', 'Contactpersonen'].map(heading => <th key={heading} scope="col" className={`${cell} font-semibold`}>{heading}</th>)}
      </tr></thead>
      <tbody>{organizations.map(organization => {
        const people = byOrganization.get(organization.id) ?? [];
        const personIds = people.map(c => c.id);
        const chosen = personIds.filter(id => selected.has(id)).length;
        const expanded = open.has(organization.id);
        const panel = `organisatie-contacten-${organization.id}`;
        const website = safeWebsite(organization.website);
        const note = visibleNote(organization.note);
        return <Fragment key={organization.id}>
          <tr className="align-top bg-muted/30">
            <td className={cell}><Checkbox className="h-5 w-5" aria-label={`Selecteer alle contactpersonen van ${organization.name}`} disabled={!personIds.length} checked={chosen === personIds.length && personIds.length > 0 ? true : chosen > 0 ? 'indeterminate' : false} onCheckedChange={value => onSelection(personIds, value === true)} /></td>
            <th scope="row" className={`${cell} min-w-56 max-w-72 text-left font-normal`}>
              <h3 className="font-display text-base" aria-label={organization.name}>{people.length ? <button type="button" aria-label={`${expanded ? 'Verberg' : 'Toon'} ${plural(people.length, 'contactpersoon', 'contactpersonen')} van ${organization.name}`} aria-expanded={expanded} aria-controls={panel} onClick={() => toggle(organization.id)} className="flex min-h-9 w-full items-start gap-2 rounded-sm text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronDown size={18} aria-hidden className={`mt-0.5 shrink-0 text-primary transition-transform ${expanded ? '' : '-rotate-90'}`} />
                <span className="break-words">{organization.name}</span>
              </button> : organization.name}</h3>
              <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">{organization.abbreviation && <span>{organization.abbreviation}</span>}<Link to="/contacten/$id" params={{ id: organization.id }} className="text-primary underline underline-offset-2" aria-label={`Gegevens bekijken van ${organization.name}`}>Gegevens bekijken</Link></div>
              {note && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{note}</p>}
            </th>
            <td className={`${cell} min-w-48 max-w-64`}>{organization.email ? <EmailLink email={organization.email} /> : dash}</td>
            <td className={`${cell} whitespace-nowrap`}>{organization.phone ? <a className="text-primary underline" href={`tel:${organization.phone.replace(/[^+\d]/g, '')}`}>{organization.phone}</a> : dash}</td>
            <td className={cell}>{website ? <a className="text-primary underline underline-offset-2" href={website} target="_blank" rel="noopener noreferrer" aria-label={`Website van ${organization.name}`}>Website</a> : dash}</td>
            <td className={`${cell} min-w-40 max-w-56 break-words`}>{organization.address || organization.postal_code || organization.city ? <>{organization.address && <p>{organization.address}</p>}{(organization.postal_code || organization.city) && <p>{[organization.postal_code, organization.city].filter(Boolean).join(' ')}</p>}</> : dash}</td>
            <td className={`${cell} min-w-32 text-muted-foreground`}>{people.length ? plural(people.length, 'contactpersoon', 'contactpersonen') : 'Geen contactpersonen'}</td>
          </tr>
          {expanded && people.length > 0 && <tr><td colSpan={7} className="border border-border bg-muted/20 p-2 sm:p-3"><div id={panel}>
            <ContactTable label={`Contactpersonen van ${organization.name}`} category={organization.category} contacts={people} selected={selected} onSelection={onSelection} />
          </div></td></tr>}
        </Fragment>;
      })}</tbody>
    </table>
  </div>;
}
