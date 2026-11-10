import { describe, it, expect } from 'vitest';
import { filterMinutes, type MinutesArchive } from '../boardMinutes';
import { categoryCounts, MINUTES_CATEGORIES } from '../boardMinutesCategories';
import { prepareMinutesPackage, minutesStatus } from '../boardMinutesImport';

const v = (id: string, meeting_id: string, date: string, title: string) => ({ id, meeting_id, version: 1, meeting_date: date, title, report: '', decisions: [], actions: [], source_url: null, content_hash: 'x', created_at: '', created_by: '' });
const m = (id: string, extra: object = {}) => ({ id, source: 'onedrive', source_id: id, created_at: '', created_by: '', ...extra });
const archive: MinutesArchive = { canManage: false, files: [], adoptions: [],
  meetings: [m('b1'), m('b2', { category: 'bestuursvergaderingen' }), m('g1', { category: 'gemeenten', subcategory: 'Tilburg' }), m('u1', { category: 'trimbos', date_known: false, meeting_year: null })],
  versions: [v('1', 'b1', '2024-03-01', 'Bestuur maart'), v('2', 'b2', '2025-01-01', 'Bestuur jan'), v('3', 'g1', '2025-05-02', 'Overleg'), v('4', 'u1', '1900-01-01', 'Trimbos gesprek')] };

describe('notulen categorieën', () => {
  it('existing meetings without category stay Bestuursvergaderingen', () => {
    expect(filterMinutes(archive, '', '', 'bestuursvergaderingen').map(r => r.meeting.id).sort()).toEqual(['b1', 'b2']);
  });
  it('counts all 18 categories incl. empty ones', () => {
    const { counts, gemeenten } = categoryCounts(archive.meetings);
    expect(counts.size).toBe(18); expect(MINUTES_CATEGORIES).toHaveLength(18);
    expect(counts.get('bestuursvergaderingen')).toBe(2); expect(counts.get('keurmerk')).toBe(0);
    expect(gemeenten).toEqual([['Tilburg', 1]]);
  });
  it('filters by gemeente, year and search', () => {
    expect(filterMinutes(archive, '', '', 'gemeenten', 'Tilburg')).toHaveLength(1);
    expect(filterMinutes(archive, '', '', 'gemeenten', 'Breda')).toHaveLength(0);
    expect(filterMinutes(archive, 'tilburg', '', '')).toHaveLength(1);
    expect(filterMinutes(archive, '', '2025', '').map(r => r.meeting.id).sort()).toEqual(['b2', 'g1']);
  });
  it('unknown date never shows the placeholder year', () => {
    expect(filterMinutes(archive, '', '1900', '')).toHaveLength(0);
    expect(filterMinutes(archive, '', 'onbekend', '').map(r => r.meeting.id)).toEqual(['u1']);
  });
});

const enc = (s: string) => new TextEncoder().encode(s);
async function hex(b: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(b))), x => x.toString(16).padStart(2, '0')).join(''); }
describe('gespreksverslagen pakket', () => {
  it('imports with category, unknown date and no adoption or board category', async () => {
    const file = enc('Verslag Trimbos'); const sha = await hex(file);
    const manifest = { schema_version: 1, kind: 'gespreksverslagen', read_at: '2026-11-10', records: [{ source_id: 'verslag:trimbos-1', category: 'trimbos', date: null, year: null, title: 'Trimbos', report: '', documents: [{ archive_path: 'verslagen/t.txt', file_name: 't.txt', sha256: sha }] }] };
    const p = await prepareMinutesPackage({ 'manifest.json': enc(JSON.stringify(manifest)), 'verslagen/t.txt': file });
    expect(p.originals[0].placement).toEqual({ category: 'trimbos', subcategory: null, year: null, dateKnown: false });
    expect(minutesStatus(false, p.originals[0].revision.details)).toBe('Gespreksverslag');
    const bad = { ...manifest, records: [{ ...manifest.records[0], category: 'bestuursvergaderingen' }] };
    await expect(prepareMinutesPackage({ 'manifest.json': enc(JSON.stringify(bad)), 'verslagen/t.txt': file })).rejects.toThrow();
  });
});
