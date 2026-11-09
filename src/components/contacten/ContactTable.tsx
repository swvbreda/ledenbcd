import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { visibleNote, type Contact } from '@/lib/addressBook';
import { EmailLink } from './ContactLinks';

const dash = <span className="text-muted-foreground" aria-label="leeg">–</span>;

/** Flat contact table. Without onEdit/onDelete it is read-only and names link to the organisation detail anchor. */
export function ContactTable({ contacts, onEdit, onDelete, label }: { contacts: Contact[]; onEdit?: (c: Contact) => void; onDelete?: (c: Contact) => void; label: string }) {
  if (!contacts.length) return <p className="py-2 text-sm text-muted-foreground">Geen contactpersonen.</p>;
  const actions = !!(onEdit || onDelete);
  return <div className="max-w-full overflow-x-auto">
    <table className="w-full min-w-[48rem] border-collapse text-sm" aria-label={label}>
      <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th scope="col" className="px-3 py-2 font-semibold">Naam</th>
          <th scope="col" className="px-3 py-2 font-semibold">Functie</th>
          <th scope="col" className="px-3 py-2 font-semibold">Afdeling</th>
          <th scope="col" className="px-3 py-2 font-semibold">E-mail</th>
          <th scope="col" className="px-3 py-2 font-semibold">Telefoon</th>
          {actions && <th scope="col" className="px-3 py-2 text-right font-semibold"><span className="sr-only">Acties</span></th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {contacts.map(c => { const note = visibleNote(c.note); return <tr key={c.id} id={actions ? `persoon-${c.id}` : undefined} className="align-top">
          <td className="px-3 py-2 font-semibold">
            {actions ? <span className="break-words">{c.name}</span> : <Link to="/contacten/$id" params={{ id: c.organization_id }} hash={`persoon-${c.id}`} className="break-words text-primary underline underline-offset-2">{c.name}</Link>}
            {note && <p className="mt-0.5 whitespace-pre-wrap break-words text-xs font-normal text-muted-foreground">{note}</p>}
          </td>
          <td className={`px-3 py-2 break-words ${c.position ? '' : 'italic text-muted-foreground'}`}>{c.position || 'Functie nog aan te vullen'}</td>
          <td className="px-3 py-2 break-words">{c.department || dash}</td>
          <td className="px-3 py-1">{c.email ? <EmailLink email={c.email} /> : dash}</td>
          <td className="px-3 py-2 whitespace-nowrap">{c.phone ? <a className="text-primary underline" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>{c.phone}</a> : dash}</td>
          {actions && <td className="px-1 py-1 text-right whitespace-nowrap">
            {onEdit && <Button size="icon" variant="ghost" title="Contactpersoon bewerken" aria-label={`Bewerk ${c.name}`} onClick={() => onEdit(c)}><Pencil size={16} /></Button>}
            {onDelete && <Button size="icon" variant="ghost" title="Contactpersoon verwijderen" aria-label={`Verwijder ${c.name}`} onClick={() => onDelete(c)}><Trash2 size={16} /></Button>}
          </td>}
        </tr>; })}
      </tbody>
    </table>
  </div>;
}
