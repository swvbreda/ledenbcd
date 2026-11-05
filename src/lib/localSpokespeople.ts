import { parse, type DefaultTreeAdapterMap } from 'parse5';

export const SPOKESPEOPLE_SOURCE = 'https://www.coffeeshopbond.nl/over-ons';
export type LocalSpokesperson = { name: string; department: string; email: string | null };
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const children = (node: Node): Node[] => 'childNodes' in node ? node.childNodes : [];
const text = (node: Node): string => 'value' in node ? node.value : children(node).map(text).join('');
const elements = (node: Node): Element[] => children(node).flatMap(child =>
  'tagName' in child && !['script', 'style'].includes(child.tagName) ? [child, ...elements(child)] : []);
const parent = (node: Node): Node | null => 'parentNode' in node ? node.parentNode : null;

/** Read only the published department section; never execute source HTML. */
export function parseLocalSpokespeople(html: string): LocalSpokesperson[] {
  const document = parse(html);
  const heading = elements(document).find(node => node.tagName === 'h3' && text(node).trim() === 'Lokale woordvoerders');
  const section = heading && parent(heading) && parent(parent(heading) as Node);
  const container = section && parent(section);
  if (!container || !text(container).includes('Lokale afdelingen')) throw new Error('Woordvoerdersbron heeft een onbekende indeling');
  const rows: LocalSpokesperson[] = [];
  for (const role of elements(container)) {
    if (role.tagName !== 'div' || children(role).some(node => 'tagName' in node)) continue;
    const match = text(role).trim().match(/^Woordvoerder\s+([\p{L}][\p{L}\s’'.-]{0,79})$/u);
    if (!match) continue;
    const details = parent(role);
    const nameNode = details && children(details).find(node => 'tagName' in node && node.tagName === 'div');
    const name = nameNode ? text(nameNode).trim() : '';
    const card = details && parent(details) && parent(parent(details) as Node);
    const emailLink = card && elements(card).find(node => node.tagName === 'a' && node.attrs.some(a => a.name === 'href' && /^mailto:[^?\s]+@coffeeshopbond\.nl$/i.test(a.value)));
    const email = emailLink?.attrs.find(a => a.name === 'href')?.value.slice(7) ?? null;
    if (!name || name.length > 160 || nameNode === role) throw new Error('Woordvoerdersbron bevat een onvolledige naam');
    rows.push({ name, department: match[1].trim(), email });
  }
  if (!rows.length || rows.length > 100 || new Set(rows.map(r => r.department.toLocaleLowerCase('nl'))).size !== rows.length) {
    throw new Error('Woordvoerdersbron bevat geen eenduidige afdelingen');
  }
  return rows.sort((a, b) => a.department.localeCompare(b.department, 'nl'));
}

export const isLocalSpokespersonRole = (role: string) => /^woordvoerder\s+\S/i.test(role.trim());