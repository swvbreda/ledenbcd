import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { visibleNote, type Contact, type Organization } from '@/lib/addressBook';
import { Checkbox } from '@/components/ui/checkbox';
import { EmailLink } from './ContactLinks';

const dash = <span className="text-muted-foreground" aria-label="leeg">–</span>;

/** One continuous category table; detail uses the same rows and adds authorized actions. */
export function ContactTable({ contacts, organizations, onEdit, onDelete, label, selected, onSelection }: {
  contacts: Contact[]; organizations?: Organization[]; onEdit?: (c: Contact) => void; onDelete?: (c: Contact) => void;
  label: string; selected?: ReadonlySet<string>; onSelection?: (ids: string[], checked: boolean) => void;
}) {
  const actions = !!(onEdit || onDelete);
  const ids = contacts.map(c => c.id);
  const checked = contacts.filter(c => selected?.has(c.id)).length;
  const selection = !!onSelection;
  const rows = organizations ? organizations.flatMap<{ c: Contact | null; o: Organization | null }>(o => {
    const people = contacts.filter(c => c.organization_id === o.id);
    return people.length ? people.map(c => ({ c, o })) : [{ c: null, o }];
  }) : contacts.map(c => ({ c, o: null }));
  const cols = 5 + Number(selection) + Number(!!organizations) + Number(actions);
  const cell = 'border border-border px-2 py-1.5';
  return <div className="min-w-0 max-w-full overflow-x-auto" tabIndex={0} aria-label={`${label} — horizontaal scrollbaar`}>
    <table className={`w-full border-collapse text-sm ${organizations ? 'min-w-[68rem]' : 'min-w-[52rem]'}`} aria-label={label}>
      <thead className="bg-muted text-left text-xs text-muted-foreground"><tr>
        {selection && <th scope="col" className={cell}><Checkbox className="h-5 w-5" aria-label={`Alles selecteren: ${label}`} disabled={!ids.length} checked={checked === ids.length && ids.length > 0 ? true : checked > 0 ? 'indeterminate' : false} onCheckedChange={v => onSelection?.(ids, v === true)} /></th>}
        {[...(organizations ? ['Organisatie'] : []), 'Naam', 'Functie', 'Afdeling', 'E-mail', 'Telefoon', ...(actions ? ['Acties'] : [])].map(h => <th key={h} scope="col" className={`${cell} font-semibold`}>{h}</th>)}
      </tr></thead>
      <tbody>{!rows.length && <tr><td colSpan={cols} className={cell}>Geen contactpersonen.</td></tr>}{rows.map(({ c, o }) => {
        const note = c ? visibleNote(c.note) : o ? visibleNote(o.note) : '';
        return <tr key={c?.id ?? o?.id} id={actions && c ? `persoon-${c.id}` : undefined} className="align-top even:bg-muted/40">
          {selection && <td className={cell}>{c && <Checkbox className="h-5 w-5" aria-label={`Selecteer ${c.name}`} checked={selected?.has(c.id) ?? false} onCheckedChange={v => onSelection?.([c.id], v === true)} />}</td>}
          {organizations && <td className={`${cell} min-w-40 max-w-56 break-words`}>{o && <><Link to="/contacten/$id" params={{ id: o.id }} className="font-semibold text-primary underline underline-offset-2">{o.name}</Link>{c && contacts.find(p => p.organization_id === o.id)?.id === c.id && visibleNote(o.note) && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer py-1">Organisatienotitie</summary><p className="whitespace-pre-wrap break-words">{visibleNote(o.note)}</p></details>}</>}</td>}
          {c ? <>
            <td className={`${cell} min-w-36 max-w-56 font-semibold`}>{actions ? <span className="break-words">{c.name}</span> : <Link to="/contacten/$id" params={{ id: c.organization_id }} hash={`persoon-${c.id}`} className="break-words text-primary underline underline-offset-2">{c.name}</Link>}{note && <details className="mt-1 text-xs font-normal text-muted-foreground"><summary className="cursor-pointer py-1">Notitie</summary><p className="whitespace-pre-wrap break-words">{note}</p></details>}</td>
            <td className={`${cell} min-w-48 max-w-72 break-words ${c.position ? '' : 'italic text-muted-foreground'}`}>{c.position || 'Functie nog aan te vullen'}</td>
            <td className={`${cell} min-w-28 max-w-48 break-words`}>{c.department || dash}</td>
            <td className={`${cell} min-w-48 max-w-64`}>{c.email ? <EmailLink email={c.email} /> : dash}</td>
            <td className={`${cell} whitespace-nowrap`}>{c.phone ? <a className="text-primary underline" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>{c.phone}</a> : dash}</td>
            {actions && <td className={`${cell} whitespace-nowrap`}>
              {onEdit && <Button className="h-8 w-8" size="icon" variant="ghost" title="Contactpersoon bewerken" aria-label={`Bewerk ${c.name}`} onClick={() => onEdit(c)}><Pencil size={15} /></Button>}
              {onDelete && <Button className="h-8 w-8" size="icon" variant="ghost" title="Contactpersoon verwijderen" aria-label={`Verwijder ${c.name}`} onClick={() => onDelete(c)}><Trash2 size={15} /></Button>}
            </td>}
          </> : <td className={`${cell} text-muted-foreground`} colSpan={5 + Number(actions)}>Geen contactpersonen.{note && <details className="text-xs"><summary className="cursor-pointer py-1">Notitie</summary><p className="whitespace-pre-wrap">{note}</p></details>}</td>}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
