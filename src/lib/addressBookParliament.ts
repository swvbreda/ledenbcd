import type { Contact } from './addressBook';

export type ParliamentGrouping = 'party' | 'committee';

type ParliamentGroup = { key: string; label: string; contacts: Contact[]; unassigned: boolean };

const normalizeLabel = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
const role = '(?:plaatsvervangend lid|vervangend lid|vast lid|lid|ondervoorzitter|vicevoorzitter|voorzitter)';
const roles = role + '(?:\\s*[/,;]\\s*' + role + ')*';
const roleSuffix = new RegExp(
  '(?:\\s*\\(\\s*' + roles + '\\s*\\)|\\s*[—–]\\s*' + roles + '|\\s+-\\s+' + roles + ')$',
  'iu',
);

/** Keep substantive parentheses and hyphens; remove only a complete, known final role. */
export function committeeName(value: string): string {
  return normalizeLabel(value).replace(roleSuffix, '').trim();
}

/** Groups are a display projection: original contacts and their IDs remain unchanged. */
export function groupParliamentContacts(contacts: Contact[], mode: ParliamentGrouping): ParliamentGroup[] {
  const groups = new Map<string, {
    key: string;
    label: string;
    unassigned: boolean;
    contacts: Map<string, Contact>;
  }>();
  const fallback = mode === 'party' ? 'Geen partij vastgelegd' : 'Geen commissie vastgelegd';

  for (const contact of contacts) {
    const labels = mode === 'party'
      ? [normalizeLabel(contact.party ?? '')]
      : (contact.committees ?? '').split(/\r\n|\r|\n/).map(committeeName).filter(Boolean);
    if (!labels.length) labels.push('');

    for (const label of labels) {
      const unassigned = !label;
      const key = unassigned ? mode + ':unassigned' : mode + ':value:' + label.toLocaleLowerCase('nl');
      let group = groups.get(key);
      if (!group) {
        group = { key, label: label || fallback, unassigned, contacts: new Map() };
        groups.set(key, group);
      }
      // A contact can appear in several committees, but only once in each group.
      if (!group.contacts.has(contact.id)) group.contacts.set(contact.id, contact);
    }
  }

  return [...groups.values()]
    .sort((a, b) => Number(a.unassigned) - Number(b.unassigned)
      || a.label.localeCompare(b.label, 'nl', { sensitivity: 'base' })
      || a.key.localeCompare(b.key, 'nl'))
    .map(group => ({
      key: group.key,
      label: group.label,
      contacts: [...group.contacts.values()],
      unassigned: group.unassigned,
    }));
}
