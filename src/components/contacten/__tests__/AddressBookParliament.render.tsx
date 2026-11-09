import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ContactTable } from '../ContactTable';
import { AddressForm } from '../AddressForm';
import { emptyContact, emptyOrganization, searchAddressBook, type AddressBook, type Contact } from '@/lib/addressBook';
import { contactsCsv, exportEmails, exportScope } from '@/lib/addressBookExport';

vi.mock('@tanstack/react-router', () => ({ Link: ({ children, params, hash }: { children: ReactNode; params?: { id: string }; hash?: string }) => <a href={`/contacten/${params?.id ?? ''}${hash ? `#${hash}` : ''}`}>{children}</a> }));
afterEach(cleanup);
const org = { ...emptyOrganization, id: 'kamer', created_at: '', name: 'SYNTH Tweede Kamer', category: 'Tweede Kamer' };
const person: Contact = { ...emptyContact, id: 'member', created_at: '', organization_id: org.id, name: 'SYNTH Kamerlid', position: 'Tweede Kamerlid', department: 'Oorspronkelijke afdeling', party: 'SYNTH Fractie', committees: 'Justitie en Veiligheid (lid)\nVolksgezondheid, Welzijn en Sport (vervangend lid)\nFinanciën (voorzitter)', email: 'lid@example.invalid', note: 'Bron: PRIVATE_SOURCE' };
const staff: Contact = { ...emptyContact, id: 'staff', created_at: '', organization_id: org.id, name: 'SYNTH Medewerker', position: 'Beleidsmedewerker', party: 'SYNTH Fractie', policy_areas: 'Financiën\nBelastingen', email: 'staf@example.invalid' };

describe('parliamentary contact information', () => {
  it('shows party next to name and committee roles in the grouped overview, with one organisation heading', () => {
    render(<ContactTable label="Tweede Kamer" organizations={[org]} contacts={[person, staff]} />);
    expect(screen.getAllByRole('columnheader').map(x => x.textContent)).toEqual(['Naam', 'Partij / fractie', 'Functie', 'Commissies / beleidsterreinen', 'E-mail', 'Telefoon']);
    expect(screen.getAllByText(org.name)).toHaveLength(1);
    const row = screen.getByText(person.name).closest('tr')!;
    expect(within(row).getByText('SYNTH Fractie')).toBeTruthy();
    expect(within(row).getByText('Oorspronkelijke afdeling')).toBeTruthy();
    expect(within(row).getByText('Justitie en Veiligheid (lid)')).toBeTruthy();
    const additional = within(row).getByText('Financiën (voorzitter)').closest('details')!;
    expect(additional.open).toBe(false);
    fireEvent.click(within(row).getByText('Nog 1 commissie'));
    expect(additional.open).toBe(true);
    expect(document.body.textContent).not.toContain('PRIVATE_SOURCE');
  });
  it('also shows the new columns on the detail table while preserving edit buttons and anchors', () => {
    const edit = vi.fn();
    render(<ContactTable label="Detail" category="Tweede Kamer" contacts={[person]} onEdit={edit} />);
    expect(screen.getByRole('columnheader', { name: 'Partij / fractie' })).toBeTruthy();
    expect(document.getElementById('persoon-member')?.tagName).toBe('TR');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerk SYNTH Kamerlid' }));
    expect(edit).toHaveBeenCalledWith(person);
  });
  it('labels staff portfolios separately and preserves ordinary tables and empty table column spans', () => {
    render(<ContactTable label="Medewerkers" category="Tweede Kamer" contacts={[staff]} />);
    expect(screen.getByText('Beleidsterreinen')).toBeTruthy();
    expect(screen.getByText('Belastingen')).toBeTruthy();
    cleanup();
    render(<ContactTable label="Gewoon" contacts={[person]} category="Banken" />);
    expect(screen.queryByRole('columnheader', { name: 'Partij / fractie' })).toBeNull();
    expect(screen.getByText('Oorspronkelijke afdeling')).toBeTruthy();
    cleanup();
    render(<ContactTable label="Leeg" category="Tweede Kamer" contacts={[]} onSelection={() => {}} />);
    expect(screen.getByText('Geen contactpersonen.').getAttribute('colspan')).toBe('7');
  });
  it('searches party, full committee list and staff portfolios and exports exactly those matches', () => {
    const data: AddressBook = { organizations: [org], contacts: [person, staff] };
    expect(searchAddressBook(data, 'synth fractie', 'Tweede Kamer').contacts).toHaveLength(2);
    const result = searchAddressBook(data, 'voorzitter', 'Tweede Kamer');
    expect(result.contacts.map(x => x.id)).toEqual(['member']);
    expect(exportEmails(exportScope(result, new Set()), false)).toEqual(['lid@example.invalid']);
    expect(searchAddressBook(data, 'belastingen', 'Tweede Kamer').contacts.map(x => x.id)).toEqual(['staff']);
    const csv = contactsCsv(data);
    expect(csv).toContain('"Partij / fractie";"Commissies";"Beleidsterreinen"');
    expect(csv).toContain('Financiën (voorzitter)');
    expect(csv).toContain('"Financiën\nBelastingen"');
    expect(csv).not.toContain('PRIVATE_SOURCE');
  });
  it('edits and saves party, commissions and staff portfolios without losing existing fields', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<AddressForm title="Bewerken" initial={{ ...person } as Record<string, string>} organization={false} category="Tweede Kamer" onSave={save} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Partij / fractie'), { target: { value: 'Nieuwe fractie' } });
    fireEvent.change(screen.getByLabelText('Commissies en rol'), { target: { value: 'Justitie en Veiligheid (voorzitter)' } });
    fireEvent.change(screen.getByLabelText('Beleidsterreinen medewerker'), { target: { value: 'Digitale zaken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ party: 'Nieuwe fractie', committees: 'Justitie en Veiligheid (voorzitter)', policy_areas: 'Digitale zaken', department: person.department, email: person.email, note: person.note })));
  });
  it('does not clear newly enriched server fields when saving an older cached contact', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const legacy = { name: 'SYNTH Oud', position: 'Tweede Kamerlid', department: 'Fractie', phone: '', email: '', note: '' };
    render(<AddressForm title="Bewerken" initial={legacy} organization={false} category="Tweede Kamer" onSave={save} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Telefoon'), { target: { value: '010 1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith({ ...legacy, phone: '010 1234567' }));
  });
});
