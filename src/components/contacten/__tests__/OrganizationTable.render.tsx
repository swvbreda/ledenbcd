import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { OrganizationTable } from '../OrganizationTable';
import { emptyContact, emptyOrganization, type Contact, type Organization } from '@/lib/addressBook';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, hash }: { children: ReactNode; params?: { id: string }; hash?: string }) =>
    <a href={`/contacten/${params?.id ?? ''}${hash ? `#${hash}` : ''}`}>{children}</a>,
}));
afterEach(cleanup);

const ministryA: Organization = {
  ...emptyOrganization, id: 'ministry-a', created_at: '', category: 'Ministerie',
  name: 'SYNTH Ministerie A', abbreviation: 'SYNTH MA',
  email: 'algemeen-a@example.invalid', phone: '000 000 0101',
  website: 'https://ministerie-a.example.invalid',
  address: 'Voorbeeldstraat 1', postal_code: '0000 AA', city: 'Voorbeeldstad',
};
const ministryB: Organization = {
  ...emptyOrganization, id: 'ministry-b', created_at: '', category: 'Ministerie',
  name: 'SYNTH Ministerie B',
};
const ada: Contact = {
  ...emptyContact, id: 'ada', created_at: '', organization_id: ministryA.id,
  name: 'SYNTH Ada', position: 'Beleidsadviseur', department: 'SYNTH Directie A',
  email: 'ada@example.invalid', phone: '000 000 0201',
};
const bea: Contact = {
  ...emptyContact, id: 'bea', created_at: '', organization_id: ministryA.id,
  name: 'SYNTH Bea', position: 'Afdelingshoofd', department: 'SYNTH Afdeling B',
  email: 'bea@example.invalid',
};
const cor: Contact = {
  ...emptyContact, id: 'cor', created_at: '', organization_id: ministryB.id,
  name: 'SYNTH Cor', position: 'Secretaris', department: 'SYNTH Directie C',
  email: 'cor@example.invalid',
};

type HarnessProps = {
  organizations?: Organization[];
  contacts?: Contact[];
  initialSelected?: string[];
  expandContacts?: boolean;
  onSelection?: (ids: string[], checked: boolean) => void;
};

function Harness({ organizations = [ministryA, ministryB], contacts = [ada, bea, cor], initialSelected = [], expandContacts = false, onSelection }: HarnessProps = {}) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  return <>
    <OrganizationTable organizations={organizations} contacts={contacts} label="Ministeries" selected={selected} expandContacts={expandContacts} onSelection={(ids, checked) => {
      onSelection?.(ids, checked);
      setSelected(previous => {
        const next = new Set(previous);
        for (const id of ids) {
          if (checked) next.add(id); else next.delete(id);
        }
        return next;
      });
    }} />
    <output aria-label="Geselecteerde contact-ID's">{JSON.stringify([...selected].sort())}</output>
  </>;
}

const generalRow = (organization: Organization) => screen.getByRole('link', { name: organization.name, exact: true }).closest('tr')!;
const organizationCheckbox = (organization: Organization) => screen.getByRole('checkbox', { name: `Selecteer alle contactpersonen van ${organization.name}` });
const allCheckbox = () => screen.getByRole('checkbox', { name: 'Alle contactpersonen selecteren: Ministeries' });
const toggle = (organization: Organization, count: number, expanded = false) => screen.getByRole('button', {
  name: `${expanded ? 'Verberg' : 'Toon'} ${count} ${count === 1 ? 'contactpersoon' : 'contactpersonen'} van ${organization.name}`,
});
const peopleTable = (organization: Organization) => screen.getByRole('table', { name: `Contactpersonen van ${organization.name}`, exact: true });
const selectedIds = (): string[] => JSON.parse(screen.getByLabelText("Geselecteerde contact-ID's").textContent ?? '[]');

describe('organization overview table', () => {
  it('starts with one general-details row per ministry and keeps its people collapsed', () => {
    render(<Harness />);
    const table = screen.getByRole('table', { name: 'Ministeries: algemene gegevens' });
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent).slice(1)).toEqual([
      'Organisatie', 'Algemeen e-mailadres', 'Telefoon', 'Website', 'Adres', 'Contactpersonen',
    ]);
    expect(within(table).getAllByRole('rowheader').map(cell => within(cell).getByRole('link').textContent)).toEqual([ministryA.name, ministryB.name]);
    const rowA = generalRow(ministryA);
    expect(within(rowA).getByRole('link', { name: ministryA.email }).getAttribute('href')).toBe(`mailto:${ministryA.email}`);
    expect(within(rowA).getByRole('link', { name: ministryA.phone }).getAttribute('href')).toBe('tel:0000000101');
    expect(within(rowA).getByRole('link', { name: `Website van ${ministryA.name}` }).getAttribute('href')).toBe('https://ministerie-a.example.invalid/');
    expect(within(rowA).getByText('Voorbeeldstraat 1')).toBeTruthy();
    expect(within(rowA).getByText('0000 AA Voorbeeldstad')).toBeTruthy();
    expect(toggle(ministryA, 2).getAttribute('aria-expanded')).toBe('false');
    expect(toggle(ministryB, 1).getAttribute('aria-expanded')).toBe('false');
    for (const person of [ada, bea, cor]) expect(screen.queryByText(person.name)).toBeNull();

    // A person's address must never fill an empty general organisation field.
    const rowB = generalRow(ministryB);
    expect(within(rowB).getAllByLabelText('leeg')).toHaveLength(4);
    expect(within(rowB).getAllByLabelText('leeg').every(cell => cell.textContent === '–')).toBe(true);
    expect(within(rowB).queryByRole('link', { name: cor.email })).toBeNull();
  });

  it('expands each ministry independently beneath its own general row with name, function, department and person mail', () => {
    render(<Harness />);
    fireEvent.click(toggle(ministryA, 2));
    const tableA = peopleTable(ministryA);
    expect(generalRow(ministryA).nextElementSibling?.contains(tableA)).toBe(true);
    expect(toggle(ministryA, 2, true).getAttribute('aria-expanded')).toBe('true');
    expect(toggle(ministryB, 1).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(cor.name)).toBeNull();
    expect(within(tableA).getAllByRole('columnheader').map(cell => cell.textContent).slice(1)).toEqual(['Naam', 'Functie', 'Afdeling', 'E-mail', 'Telefoon']);
    for (const person of [ada, bea]) {
      const row = within(tableA).getByRole('link', { name: person.name }).closest('tr')!;
      expect(within(row).getByText(person.position)).toBeTruthy();
      expect(within(row).getByText(person.department)).toBeTruthy();
      expect(within(row).getByRole('link', { name: person.email }).getAttribute('href')).toBe(`mailto:${person.email}`);
      expect(within(row).getByRole('link', { name: person.name }).getAttribute('href')).toBe(`/contacten/${ministryA.id}#persoon-${person.id}`);
      expect(within(generalRow(ministryA)).queryByRole('link', { name: person.email })).toBeNull();
    }
    expect(within(tableA).queryByRole('link', { name: ministryA.email })).toBeNull();

    fireEvent.click(toggle(ministryB, 1));
    expect(peopleTable(ministryA)).toBeTruthy();
    expect(within(peopleTable(ministryB)).getByText(cor.name)).toBeTruthy();
    fireEvent.click(toggle(ministryA, 2, true));
    expect(screen.queryByRole('table', { name: `Contactpersonen van ${ministryA.name}`, exact: true })).toBeNull();
    expect(peopleTable(ministryB)).toBeTruthy();
    expect(toggle(ministryB, 1, true).getAttribute('aria-expanded')).toBe('true');
    expect(within(generalRow(ministryA)).getByRole('link', { name: ministryA.email })).toBeTruthy();
    expect(within(generalRow(ministryB)).getAllByLabelText('leeg')).toHaveLength(4);
  });

  it('selects or clears only one ministry’s contacts and preserves another ministry’s selection', () => {
    const onSelection = vi.fn();
    render(<Harness initialSelected={[cor.id]} onSelection={onSelection} />);
    fireEvent.click(organizationCheckbox(ministryA));
    expect(onSelection).toHaveBeenLastCalledWith([ada.id, bea.id], true);
    expect(selectedIds()).toEqual([ada.id, bea.id, cor.id]);
    expect(organizationCheckbox(ministryA).getAttribute('aria-checked')).toBe('true');
    expect(organizationCheckbox(ministryB).getAttribute('aria-checked')).toBe('true');
    expect(allCheckbox().getAttribute('aria-checked')).toBe('true');
    expect(toggle(ministryA, 2).getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle(ministryA, 2));
    for (const person of [ada, bea]) expect(screen.getByRole('checkbox', { name: `Selecteer ${person.name}` }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(organizationCheckbox(ministryA));
    expect(onSelection).toHaveBeenLastCalledWith([ada.id, bea.id], false);
    expect(selectedIds()).toEqual([cor.id]);
    expect(organizationCheckbox(ministryA).getAttribute('aria-checked')).toBe('false');
    expect(organizationCheckbox(ministryB).getAttribute('aria-checked')).toBe('true');
    expect(allCheckbox().getAttribute('aria-checked')).toBe('mixed');
  });

  it('reflects a child selection as indeterminate and preserves it while its people are hidden', () => {
    const onSelection = vi.fn();
    render(<Harness onSelection={onSelection} />);
    fireEvent.click(toggle(ministryA, 2));
    fireEvent.click(screen.getByRole('checkbox', { name: `Selecteer ${ada.name}` }));
    expect(onSelection).toHaveBeenLastCalledWith([ada.id], true);
    expect(selectedIds()).toEqual([ada.id]);
    expect(organizationCheckbox(ministryA).getAttribute('aria-checked')).toBe('mixed');
    expect(organizationCheckbox(ministryB).getAttribute('aria-checked')).toBe('false');
    expect(allCheckbox().getAttribute('aria-checked')).toBe('mixed');

    fireEvent.click(toggle(ministryA, 2, true));
    expect(screen.queryByRole('checkbox', { name: `Selecteer ${ada.name}` })).toBeNull();
    expect(selectedIds()).toEqual([ada.id]);
    expect(organizationCheckbox(ministryA).getAttribute('aria-checked')).toBe('mixed');
    fireEvent.click(toggle(ministryA, 2));
    expect(screen.getByRole('checkbox', { name: `Selecteer ${ada.name}` }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: `Selecteer ${bea.name}` }).getAttribute('aria-checked')).toBe('false');
    expect(onSelection).toHaveBeenCalledTimes(1);
  });

  it('keeps an organisation without people visible, with general details and disabled selection controls', () => {
    const noPeople: Organization = { ...ministryA, id: 'empty-ministry', name: 'SYNTH Ministerie Zonder Personen', email: 'algemeen-leeg@example.invalid' };
    const onSelection = vi.fn();
    render(<Harness organizations={[noPeople]} contacts={[]} expandContacts onSelection={onSelection} />);
    expect(within(generalRow(noPeople)).getByRole('link', { name: noPeople.email }).getAttribute('href')).toBe(`mailto:${noPeople.email}`);
    expect(within(generalRow(noPeople)).getByText(noPeople.address)).toBeTruthy();
    expect(within(generalRow(noPeople)).getByText('Geen contactpersonen')).toBeTruthy();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(organizationCheckbox(noPeople).hasAttribute('disabled')).toBe(true);
    expect(allCheckbox().hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: /^(Toon|Verberg) / })).toBeNull();
    fireEvent.click(organizationCheckbox(noPeople));
    fireEvent.click(allCheckbox());
    expect(onSelection).not.toHaveBeenCalled();
    expect(selectedIds()).toEqual([]);
  });

  it('uses only filtered contacts belonging to the shown organisations for selection callbacks, even when collapsed', () => {
    const outside: Contact = { ...emptyContact, id: 'outside', created_at: '', organization_id: 'not-shown', name: 'SYNTH Buiten Selectie', email: 'buiten@example.invalid' };
    const onSelection = vi.fn();
    render(<Harness contacts={[ada, cor, outside]} expandContacts onSelection={onSelection} />);
    expect(toggle(ministryA, 1, true).getAttribute('aria-expanded')).toBe('true');
    expect(toggle(ministryB, 1, true).getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByText(bea.name)).toBeNull();
    expect(screen.queryByText(outside.name)).toBeNull();
    fireEvent.click(organizationCheckbox(ministryA));
    expect(onSelection).toHaveBeenLastCalledWith([ada.id], true);
    fireEvent.click(toggle(ministryA, 1, true));
    fireEvent.click(allCheckbox());
    expect(onSelection).toHaveBeenLastCalledWith([ada.id, cor.id], true);
    expect(selectedIds()).toEqual([ada.id, cor.id]);
    expect(organizationCheckbox(ministryA).getAttribute('aria-checked')).toBe('true');
    expect(organizationCheckbox(ministryB).getAttribute('aria-checked')).toBe('true');
    expect(toggle(ministryA, 1).getAttribute('aria-expanded')).toBe('false');
  });
});
