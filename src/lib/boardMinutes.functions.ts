import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { minutesSaveSchema, requireMinutesAccess, validateMinutesBytes, MINUTES_BUCKET, type MinuteVersion, type MinutesArchive } from './boardMinutes';

export const loadBoardMinutes = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<MinutesArchive> => {
  const canManage = await requireMinutesAccess(context);
  const sb = context.supabase;
  const [meetings, versions, files, adoptions] = await Promise.all([
    sb.from('board_minutes_meetings').select('*').order('created_at', { ascending: false }),
    sb.from('board_minutes_versions').select('*').order('version', { ascending: false }),
    sb.from('board_minutes_files').select('*'), sb.from('board_minutes_adoptions').select('*'),
  ]);
  if ([meetings, versions, files, adoptions].some(r => r.error)) throw new Error('Bestuursnotulen konden niet worden geladen.');
  return { meetings: meetings.data ?? [], versions: (versions.data ?? []) as MinuteVersion[], files: files.data ?? [], adoptions: adoptions.data ?? [], canManage };
});

export const saveBoardMinutes = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(d => minutesSaveSchema.parse(d)).handler(async ({ data, context }) => {
  await requireMinutesAccess(context, true);
  const { data: id, error } = await context.supabase.rpc('board_minutes_save_revision', {
    p_meeting: data.meetingId, p_expected: data.expectedVersion, p_source: data.source, p_source_id: data.sourceId,
    p_date: data.date, p_title: data.title, p_report: data.report, p_decisions: data.decisions, p_actions: data.actions,
    p_url: data.sourceUrl || null, p_confirm: data.confirm, p_file_hash: data.fileHash ?? null,
  });
  if (error) throw new Error(error.message);
  const { data: version, error: readError } = await context.supabase.from('board_minutes_versions').select('meeting_id,id').eq('id', id).single();
  if (readError || !version) throw new Error('Versie opgeslagen, maar kon niet worden teruggelezen.');
  return version;
});

export const adoptBoardMinutes = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(d => z.object({ versionId: z.string().uuid(), confirm: z.literal(true) }).parse(d)).handler(async ({ data, context }) => {
  await requireMinutesAccess(context, true);
  const { error } = await context.supabase.rpc('board_minutes_adopt', { p_version: data.versionId, p_confirm: data.confirm });
  if (error) throw new Error(error.message);
  return { ok: true };
});

export const uploadBoardMinutesFile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(d => {
  if (!(d instanceof FormData)) throw new Error('Ongeldige upload.');
  const versionId = z.string().uuid().parse(d.get('versionId'));
  const file = d.get('file');
  if (!(file instanceof File)) throw new Error('Selecteer een bestand.');
  return { versionId, file };
}).handler(async ({ data, context }) => {
  await requireMinutesAccess(context, true);
  const sb = context.supabase;
  const { data: version, error } = await sb.from('board_minutes_versions').select('meeting_id').eq('id', data.versionId).single();
  if (error || !version) throw new Error('Versie niet gevonden.');
  const { data: adoption, error: adoptionError } = await sb.from('board_minutes_adoptions').select('id').eq('version_id', data.versionId).maybeSingle();
  if (adoptionError || adoption) throw new Error('Maak eerst een nieuwe conceptversie.');
  if (data.file.size > 20*1024*1024) throw new Error('Bestand is groter dan 20 MB.');
  const buffer = await data.file.arrayBuffer();
  const type = validateMinutesBytes(data.file.name, new Uint8Array(buffer));
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
  const path = `${version.meeting_id}/${hash}.${type.ext}`;
  const { error: uploadError } = await sb.storage.from(MINUTES_BUCKET).upload(path, buffer, { upsert: false, contentType: type.mime });
  if (uploadError && !('statusCode' in uploadError && String(uploadError.statusCode)==='409')) throw new Error('Origineel bestand kon niet worden opgeslagen.');
  const { data: id, error: attachError } = await sb.rpc('board_minutes_attach', { p_version: data.versionId, p_path: path, p_name: data.file.name, p_hash: hash, p_size: data.file.size });
  if (attachError) throw new Error(`Bestand behouden, koppelen mislukt: ${attachError.message}`);
  return { id, originalName: data.file.name };
});