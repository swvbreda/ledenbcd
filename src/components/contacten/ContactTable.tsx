import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { visibleNote, isParliament, type Contact, type Organization } from '@/lib/addressBook';
import { committeeName } from '@/lib/addressBookParliament';
import { Checkbox } from '@/components/ui/checkbox';
import { EmailLink } from './ContactLinks';

const dash = <span className="text-muted-foreground" aria-label="leeg">–</span>;

function ParliamentaryAssignments({ contact, committee }: { contact: Contact; committee?: string }) {
  if (committee) {
    const name = committee.toLocaleLowerCase('nl');
    const assignments = (contact.committees ?? '').split(/\r\n|\r|\n/).map(line => line.trim()).filter(line => committeeName(line).toLocaleLowerCase('nl') === name);
    return assignments.length ? <ul className="space-y-0.5">{[...new Set(assignments)].map(line => <li key={line}>{line}</li>)}</ul> : <span className="text-muted-foreground">Niet vastgelegd</span>;
  }
  const groups = [
    { label: 'Commissies', one: 'commissie', more: 'commissies', value: contact.committees },
    { label: 'Beleidsterreinen', one: 'beleidsterrein', more: 'beleidsterreinen', value: contact.policy_areas },
  ].map(group => ({ ...group, lines: (group.value ?? '').split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean) })).filter(group => group.lines.length);
  if (!groups.length) return <span className="text-muted-foreground">Niet vastgelegd</span>;
  return <div className="space-y-2">{groups.map(group => <div key={group.label}>
    {group.label === 'Beleidsterreinen' && <p className="mb-0.5 text-xs font-medium text-muted-foreground">Beleidsterreinen</p>}
    <ul className="space-y-0.5">{group.lines.slice(0, 2).map((line, i) => <li key={i}>{line}</li>)}</ul>
    {group.lines.length > 2 && <details className="mt-1"><summary className="cursor-pointer text-xs text-primary underline underline-offset-2">Nog {group.lines.length - 2} {group.lines.length === 3 ? group.one : group.more}</summary><ul className="mt-1 space-y-0.5">{group.lines.slice(2).map((line, i) => <li key={i}>{line}</li>)}</ul></details>}
  </div>)}</div>;
}

/** One continuous category table; detail uses the same rows and adds authorized actions. */
export function ContactTable({ contacts, organizations, category = '', onEdit, onDelete, label, selected, onSelection, committee }: {
  contacts: Contact[]; organizations?: Organization[]; onEdit?: (c: Contact) => void; onDelete?: (c: Contact) => void;
  label: string; category?: string; selected?: ReadonlySet<string>; onSelection?: (ids: string[], checked: boolean) => void; committee?: string;
}) {
  const parliamentary = isParliament(category) || !!organizations?.length && organizations.every(o => isParliament(o.category));
  const singleParliament = parliamentary && organizations?.length === 1 ? organizations[0] : null;
  const showOrganizations = !!organizations && !singleParliament;
  const actions = !!(onEdit || onDelete);
  const ids = contacts.map(c => c.id);
  const checked = contacts.filter(c => selected?.has(c.id)).length;
  const selection = !!onSelection;
  const rows = organizations ? organizations.flatMap<{ c: Contact | null; o: Organization | null }>(o => {
    const people = contacts.filter(c => c.organization_id === o.id);
    return people.length ? people.map(c => ({ c, o })) : [{ c: null, o }];
  }) : contacts.map(c => ({ c, o: null }));
  const personCols = parliamentary ? 6 : 5;
  const cols = personCols + Number(selection) + Number(showOrganizations) + Number(actions);
  const cell = 'border border-border px-2 py-1.5';
  return <div className="min-w-0 max-w-full">
    {singleParliament && <p className="px-3 py-2 text-sm"><Link to="/contacten/$id" params={{ id: singleParliament.id }} className="text-primary underline underline-offset-2">{singleParliament.name}</Link></p>}
    <div className="min-w-0 max-w-full overflow-x-auto" tabIndex={0} aria-label={`${label} — horizontaal scrollbaar`}>
    <table className={`w-full border-collapse text-sm ${showOrganizations || parliamentary ? 'min-w-[68rem]' : 'min-w-[52rem]'}`} aria-label={label}>
      <thead className="bg-muted text-left text-xs text-muted-foreground"><tr>
        {selection && <th scope="col" className={cell}><Checkbox className="h-5 w-5" aria-label={`Alles selecteren: ${label}`} disabled={!ids.length} checked={checked === ids.length && ids.length > 0 ? true : checked > 0 ? 'indeterminate' : false} onCheckedChange={v => onSelection?.(ids, v === true)} /></th>}
        {[...(showOrganizations ? ['Organisatie'] : []), 'Naam', ...(parliamentary ? ['Partij / fractie', 'Functie', committee ? 'Commissie / rol' : 'Commissies / beleidsterreinen'] : ['Functie', 'Afdeling']), 'E-mail', 'Telefoon', ...(actions ? ['Acties'] : [])].map(h => <th key={h} scope="col" className={`${cell} font-semibold`}>{h}</th>)}
      </tr></thead>
      <tbody>{!rows.length && <tr><td colSpan={cols} className={cell}>Geen contactpersonen.</td></tr>}{rows.map(({ c, o }) => {
        const note = c ? visibleNote(c.note) : o ? visibleNote(o.note) : '';
        return <tr key={c?.id ?? o?.id} id={actions && c ? `persoon-${c.id}` : undefined} className="align-top even:bg-muted/40">
          {selection && <td className={cell}>{c && <Checkbox className="h-5 w-5" aria-label={`Selecteer ${c.name}`} checked={selected?.has(c.id) ?? false} onCheckedChange={v => onSelection?.([c.id], v === true)} />}</td>}
          {showOrganizations && <td className={`${cell} min-w-40 max-w-56 break-words`}>{o && <><Link to="/contacten/$id" params={{ id: o.id }} className="font-semibold text-primary underline underline-offset-2">{o.name}</Link>{c && contacts.find(p => p.organization_id === o.id)?.id === c.id && visibleNote(o.note) && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{visibleNote(o.note)}</p>}</>}</td>}
          {c ? <>
            <td className={`${cell} min-w-36 max-w-56 font-semibold`}>{actions ? <span className="break-words">{c.name}</span> : <Link to="/contacten/$id" params={{ id: c.organization_id }} hash={`persoon-${c.id}`} className="break-words text-primary underline underline-offset-2">{c.name}</Link>}{note && <details className="mt-1 text-xs font-normal text-muted-foreground"><summary className="cursor-pointer py-1">Notitie</summary><p className="whitespace-pre-wrap break-words">{note}</p></details>}</td>
            {parliamentary && <td className={`${cell} min-w-28 max-w-40 break-words`}>{c.party || dash}</td>}
            <td className={`${cell} min-w-48 max-w-72 break-words ${c.position ? '' : 'italic text-muted-foreground'}`}>{c.position || 'Functie nog aan te vullen'}{parliamentary && c.department && c.department !== c.party && <p className="mt-0.5 text-xs font-normal not-italic text-muted-foreground">{c.department}</p>}</td>
            {parliamentary ? <td className={`${cell} min-w-64 max-w-96 break-words`}><ParliamentaryAssignments contact={c} committee={committee} /></td> : <td className={`${cell} min-w-28 max-w-48 break-words`}>{c.department || dash}</td>}
            <td className={`${cell} min-w-48 max-w-64`}>{c.email ? <EmailLink email={c.email} /> : dash}</td>
            <td className={`${cell} whitespace-nowrap`}>{c.phone ? <a className="text-primary underline" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>{c.phone}</a> : dash}</td>
            {actions && <td className={`${cell} whitespace-nowrap`}>
              {onEdit && <Button className="h-8 w-8" size="icon" variant="ghost" title="Contactpersoon bewerken" aria-label={`Bewerk ${c.name}`} onClick={() => onEdit(c)}><Pencil size={15} /></Button>}
              {onDelete && <Button className="h-8 w-8" size="icon" variant="ghost" title="Contactpersoon verwijderen" aria-label={`Verwijder ${c.name}`} onClick={() => onDelete(c)}><Trash2 size={15} /></Button>}
            </td>}
          </> : <td className={`${cell} text-muted-foreground`} colSpan={personCols + Number(actions)}>Geen contactpersonen.{note && <p className="whitespace-pre-wrap break-words text-xs">{note}</p>}</td>}
        </tr>;
      })}</tbody>
    </table>
  </div></div>;
}

