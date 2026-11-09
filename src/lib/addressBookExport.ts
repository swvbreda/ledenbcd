import { categoryLabel, type AddressBook } from './addressBook';
import { cleanEmailList } from './emailList';

/** Selection is intersected with current results; collapsed categories never change scope. */
export function exportScope(results: AddressBook, selected: ReadonlySet<string>): AddressBook {
  const chosen = results.contacts.filter(c => selected.has(c.id));
  if (!chosen.length) return results;
  const organizations = new Set(chosen.map(c => c.organization_id));
  return { contacts: chosen, organizations: results.organizations.filter(o => organizations.has(o.id)) };
}
export function exportEmails(scope: AddressBook, general: boolean) {
  return cleanEmailList([...scope.contacts.map(c => c.email), ...(general ? scope.organizations.map(o => o.email) : [])]);
}
export function csvCell(value: string) {
  const safe = /^[\s\x00-\x1f\x7f]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function contactsCsv(scope: AddressBook): string {
  const orgs = new Map(scope.organizations.map(o => [o.id, o]));
  const rows = [['Categorie', 'Organisatie', 'Naam', 'Functie', 'Afdeling', 'E-mailadres', 'Telefoon', 'Partij / fractie', 'Commissies', 'Beleidsterreinen'], ...scope.contacts.map(c => {
    const o = orgs.get(c.organization_id);
    return [categoryLabel(o?.category ?? ''), o?.name ?? '', c.name, c.position, c.department, cleanEmailList([c.email]).join('; '), c.phone, c.party ?? '', c.committees ?? '', c.policy_areas ?? ''];
  })];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
export function downloadAddressFile(text: string, extension: 'csv' | 'txt') {
  const blob = new Blob([text], { type: extension === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `bcd-contacten.${extension}`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
