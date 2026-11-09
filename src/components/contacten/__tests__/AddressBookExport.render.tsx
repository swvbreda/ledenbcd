import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { emptyOrganization, searchAddressBook, type AddressBook } from '@/lib/addressBook';
import { exportScope, exportEmails, contactsCsv, csvCell } from '@/lib/addressBookExport';
import { ExportToolbar } from '../ExportToolbar';

const org = (id: string) => ({ ...emptyOrganization, id, created_at: '', name: `Org ${id}`, email: `${id}@example.org` });
const contact = (id: string, organization_id: string, email: string) => ({ id, organization_id, created_at: '', name: id, email, position: '', department: '', phone: '', note: 'SECRET SOURCE' });
const data: AddressBook = { organizations: [org('a'), org('b')], contacts: [contact('1', 'a', 'One@example.org; two@example.org'), contact('2', 'a', 'ONE@example.org, invalid'), contact('3', 'b', '')] };
afterEach(cleanup);
describe('local address-book export', () => {
  it('exports all filtered results unless current rows are selected, ignores stale IDs', () => {
    const results = searchAddressBook(data, 'Org a', 'Overig');
    expect(exportScope(results, new Set()).contacts.map(c => c.id)).toEqual(['1', '2']);
    expect(exportScope(results, new Set(['2', '3'])).contacts.map(c => c.id)).toEqual(['2']);
    expect(exportScope(results, new Set(['3'])).contacts.map(c => c.id)).toEqual(['1', '2']);
  });
  it('splits, validates, deduplicates case-insensitively; general emails are opt-in and scope-bound', () => {
    expect(exportEmails(data, false)).toEqual(['One@example.org', 'two@example.org']);
    const scope = exportScope(data, new Set(['1']));
    expect(exportEmails(scope, true)).toEqual(['One@example.org', 'two@example.org', 'a@example.org']);
    expect(exportEmails({ organizations: [org('b')], contacts: [data.contacts[2]] }, false)).toEqual([]);
  });
  it('CSV includes contacts without email, only seven approved fields and never notes/IDs', () => {
    const csv = contactsCsv(data);
    expect(csv.startsWith('\uFEFF"Categorie";"Organisatie"')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(5);
    expect(csv).toContain('"Overig";"Org b";"3";"";"";"";""');
    expect(csv).not.toContain('SECRET SOURCE');
    expect(csv).not.toContain('organization_id');
  });
  it('escapes quotes/newlines and neutralizes formula prefixes after whitespace and controls', () => {
    expect(csvCell('a;"b"\nnext')).toBe('"a;""b""\nnext"');
    for (const value of ['=SUM(A1)', ' +2', '\t-3', '\r\n@cmd', '\u0000=1']) expect(csvCell(value)).toBe(`"'${value}"`);
    expect(csvCell('Gewone functie')).toBe('"Gewone functie"');
  });
  it('clipboard failure offers selectable text and changing scope removes old addresses', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const { rerender } = render(<ExportToolbar results={data} selected={new Set()} onClear={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'E-mailadressen kopiëren' }));
    const field = await screen.findByRole('textbox', { name: 'E-mailadressen om te kopiëren' });
    expect((field as HTMLTextAreaElement).value).toBe('One@example.org; two@example.org');
    fireEvent.focus(field);
    expect((field as HTMLTextAreaElement).selectionEnd).toBe((field as HTMLTextAreaElement).value.length);
    rerender(<ExportToolbar key="new-context" results={{ organizations: [org('b')], contacts: [data.contacts[2]] }} selected={new Set()} onClear={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'E-mailadressen kopiëren' }).hasAttribute('disabled')).toBe(true);
  });
  it('general address option defaults off and affects emails only, not CSV rows', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<ExportToolbar results={data} selected={new Set(['3'])} onClear={() => {}} />);
    expect(screen.getByRole('checkbox').getAttribute('data-state')).toBe('unchecked');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'E-mailadressen kopiëren' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('b@example.org'));
    expect(contactsCsv(exportScope(data, new Set(['3']))).split('\r\n')).toHaveLength(3);
  });
});