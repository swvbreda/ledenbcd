import { describe, expect, it } from 'vitest';
import type { Contact } from '../addressBook';
import { committeeName, groupParliamentContacts } from '../addressBookParliament';

const contact = (id: string, values: Partial<Contact> = {}): Contact => ({
  id, created_at: '', organization_id: 'parliament', name: 'SYNTH ' + id,
  position: 'Tweede Kamerlid', department: '', email: '', phone: '', note: '',
  party: '', committees: '', policy_areas: '', ...values,
});

describe('parliament contact grouping', () => {
  it('uses stored party only, merges case and whitespace, and keeps missing parties last', () => {
    const groups = groupParliamentContacts([
      contact('v1', { party: '  VVD  ', department: 'CDA' }),
      contact('missing', { party: undefined, department: 'D66' }),
      contact('cu', { party: 'ChristenUnie' }),
      contact('v2', { party: 'vvd' }),
      contact('mark1', { party: 'Groep  Markuszower' }),
      contact('mark2', { party: 'groep\u00a0Markuszower' }),
    ], 'party');

    expect(groups.map(group => group.label)).toEqual([
      'ChristenUnie', 'Groep Markuszower', 'VVD', 'Geen partij vastgelegd',
    ]);
    expect(groups[1].contacts.map(person => person.id)).toEqual(['mark1', 'mark2']);
    expect(groups[2].contacts.map(person => person.id)).toEqual(['v1', 'v2']);
    expect(groups[3].contacts.map(person => person.id)).toEqual(['missing']);
    expect(groups.map(group => group.unassigned)).toEqual([false, false, false, true]);
  });

  it('groups known parenthesized and dash-separated membership roles under one committee', () => {
    const suffixes = [
      '(lid)', '(plaatsvervangend lid)', '(voorzitter / lid)', '(ondervoorzitter / lid)',
      '(  voorzitter   /   lid  )', '— lid', '– plaatsvervangend lid', ' - voorzitter / lid',
      '— ONDERVOORZITTER',
    ];
    const groups = groupParliamentContacts(suffixes.map((suffix, index) =>
      contact(String(index), { committees: 'Justitie en Veiligheid ' + suffix })), 'committee');

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Justitie en Veiligheid');
    expect(groups[0].contacts).toHaveLength(suffixes.length);
    expect(groups[0].unassigned).toBe(false);
  });

  it('preserves substantive parentheses, acronyms, hyphens and unknown final suffixes', () => {
    expect(committeeName('  Tijdelijke commissie (TCGCT) — voorzitter / lid  '))
      .toBe('Tijdelijke commissie (TCGCT)');
    expect(committeeName('Contactgroep Nederland-België (lid)')).toBe('Contactgroep Nederland-België');
    expect(committeeName('Onderwijs (cultuur)')).toBe('Onderwijs (cultuur)');
    expect(committeeName('Commissie EU – werkgroep')).toBe('Commissie EU – werkgroep');
    expect(committeeName('Commissie (lid / adviseur)')).toBe('Commissie (lid / adviseur)');
    expect(committeeName('Contactgroep-lid')).toBe('Contactgroep-lid');
  });

  it('deduplicates repeated lines and duplicate input records by contact ID within a group', () => {
    const person = contact('same', {
      committees: 'Financiën (lid)\r\n financiën  — plaatsvervangend lid\nFINANCIËN (voorzitter / lid)',
    });
    const duplicate = { ...person, committees: 'FINANCIËN (lid)' };
    const groups = groupParliamentContacts([person, duplicate], 'committee');

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Financiën');
    expect(groups[0].contacts).toHaveLength(1);
    expect(groups[0].contacts[0]).toBe(person);
    expect(person.committees).toContain('plaatsvervangend lid');
  });

  it('retains the same contact and ID in each assigned committee and sorts groups in Dutch', () => {
    const person = contact('multi', {
      committees: 'Zorg (lid)\nFinanciën — lid\nÁlgemene Zaken (plaatsvervangend lid)',
    });
    const groups = groupParliamentContacts([person], 'committee');

    expect(groups.map(group => group.label)).toEqual(['Álgemene Zaken', 'Financiën', 'Zorg']);
    expect(new Set(groups.map(group => group.key)).size).toBe(3);
    for (const group of groups) {
      expect(group.contacts).toHaveLength(1);
      expect(group.contacts[0]).toBe(person);
      expect(group.contacts[0].id).toBe('multi');
    }
  });

  it('keeps contacts without recorded committees visible without inferring policy-area membership', () => {
    const groups = groupParliamentContacts([
      contact('staff', { committees: undefined, policy_areas: 'Justitie en Veiligheid' }),
      contact('member', { committees: 'Zorg (lid)' }),
      contact('blank', { committees: ' \r\n\t\n' }),
      contact('role-only', { committees: '(lid)' }),
    ], 'committee');

    expect(groups.map(group => group.label)).toEqual(['Zorg', 'Geen commissie vastgelegd']);
    expect(groups[1].unassigned).toBe(true);
    expect(groups[1].contacts.map(person => person.id)).toEqual(['staff', 'blank', 'role-only']);
  });

  it('returns no empty placeholder groups for an empty result set', () => {
    expect(groupParliamentContacts([], 'party')).toEqual([]);
    expect(groupParliamentContacts([], 'committee')).toEqual([]);
  });
});
