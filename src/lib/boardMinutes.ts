import { z } from 'zod';
import { minuteActionRowsSchema } from './boardMinutesTasks';

export const MINUTES_BUCKET = 'board-minutes';
export const MAX_MINUTES_BYTES = 20 * 1024 * 1024;
export const MINUTES_ACCEPT = '.pdf,.docx,.doc,.txt';
export const minutesSaveSchema = z.object({
  meetingId: z.string().uuid().nullable(), expectedVersion: z.string().uuid().nullable(),
  source: z.enum(['upload', 'onedrive', 'topical']), sourceId: z.string().trim().max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().trim().min(1).max(300),
  report: z.string().max(200000), decisions: z.array(z.string().max(3000)).max(200),
  actions: z.array(z.string().max(3000)).max(200),
  action_rows: minuteActionRowsSchema.optional(),
  sourceUrl: z.string().max(2000).refine(v => !v || safeMinutesUrl(v) !== null, 'Gebruik een veilige https-bronverwijzing.'),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  confirm: z.literal(true),
}).superRefine((d, ctx) => {
  if (d.source !== 'upload' && !d.sourceId) ctx.addIssue({ code: 'custom', path: ['sourceId'], message: 'Bron-id is verplicht bij import.' });
  const date = new Date(d.date + 'T00:00:00Z');
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== d.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Ongeldige vergaderdatum.' });
});
export type MinutesInput = z.infer<typeof minutesSaveSchema>;
export type MinuteMeeting = { id: string; source: string; source_id: string; created_at: string; created_by: string };
export type MinuteVersion = { id: string; meeting_id: string; version: number; meeting_date: string; title: string; report: string; decisions: string[]; actions: string[]; source_url: string | null; content_hash: string; created_at: string; created_by: string };
export type MinuteFile = { id: string; version_id: string; path: string; original_name: string; sha256: string; size_bytes: number; created_at: string; created_by: string };
export type MinuteAdoption = { id: string; version_id: string; adopted_at: string; adopted_by: string };
export type MinutesArchive = { meetings: MinuteMeeting[]; versions: MinuteVersion[]; files: MinuteFile[]; adoptions: MinuteAdoption[]; canManage: boolean; imports?: {version_id:string;details:import('./boardMinutesImport').ImportDetails;source_text:string}[] };

export function safeMinutesUrl(value: string): string | null {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export const minutesSourceLabel = (s: string) => ({ upload: 'Upload', onedrive: 'OneDrive', topical: 'Topical' })[s] ?? s;
export function filterMinutes(archive: MinutesArchive, query: string, year: string) {
  const words = query.trim().toLocaleLowerCase('nl').split(/\s+/).filter(Boolean);
  return archive.meetings.flatMap(meeting => {
    const versions = archive.versions.filter(v => v.meeting_id === meeting.id).sort((a,b) => b.version-a.version);
    const latest = versions[0];
    if (!latest || (year && latest.meeting_date.slice(0,4) !== year)) return [];
    const matching = versions.find(v => {
      const haystack = [v.title,v.report,...v.decisions,...v.actions,archive.imports?.find(d=>d.version_id===v.id)?.source_text??''].join(' ').toLocaleLowerCase('nl');
      return words.every(w => haystack.includes(w));
    });
    return matching ? [{ meeting, latest, matchingVersion: matching.id }] : [];
  }).sort((a,b) => b.latest.meeting_date.localeCompare(a.latest.meeting_date));
}

/** Checks original bytes as well as the extension; never renders uploaded HTML. */
export function validateMinutesBytes(name: string, bytes: Uint8Array): { ext: string; mime: string } {
  if (!name || name.length>255 || /[/\\\u0000-\u001f\u007f]/.test(name)) throw new Error('Ongeldige oorspronkelijke bestandsnaam.');
  if (!bytes.length || bytes.length > MAX_MINUTES_BYTES) throw new Error('Een bestand moet tussen 1 byte en 20 MB zijn.');
  const ext = name.split('.').pop()?.toLowerCase();
  const prefix = Array.from(bytes.slice(0,8));
  if (ext === 'pdf' && new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-') return { ext, mime: 'application/pdf' };
  if (ext === 'docx' && prefix[0]===80 && prefix[1]===75 && prefix[2]===3 && prefix[3]===4) return { ext, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  if (ext === 'doc' && prefix.join(',') === '208,207,17,224,161,177,26,225') return { ext, mime: 'application/msword' };
  if (ext === 'txt') {
    try { const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); if (!text.includes('\0')) return { ext, mime: 'text/plain;charset=utf-8' }; } catch { /* invalid UTF-8 */ }
  }
  throw new Error('Alleen geldige PDF-, DOCX-, DOC- en UTF-8 TXT-bestanden zijn toegestaan.');
}

export async function requireMinutesAccess(ctx: { supabase: { rpc: (name: 'board_minutes_can_read' | 'has_role', input?: { _user_id: string; _role: 'admin' }) => PromiseLike<{ data: unknown; error: unknown }> }; userId: string }, manage = false) {
  const [read, admin] = await Promise.all([
    ctx.supabase.rpc('board_minutes_can_read'),
    ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' }),
  ]);
  if (read.error || admin.error || read.data !== true || (manage && admin.data !== true)) throw new Error('Geen toegang tot bestuursnotulen.');
  return admin.data === true;
}

export function downloadMinutesBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}