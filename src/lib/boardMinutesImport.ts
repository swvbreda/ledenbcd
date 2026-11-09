import { z } from 'zod';
import { minutesSaveSchema, validateMinutesBytes } from './boardMinutes';

export const importDetailsSchema = z.object({
  status: z.enum(['historisch-onbevestigd', 'concept']), reviewRequired: z.literal(true),
  reportMissing: z.boolean(), meetingType: z.enum(['bestuursvergadering', 'dagelijks-bestuur']),
  originalName: z.string().max(255), sourcePaths: z.array(z.string().max(2000)).max(100),
  dateBasis: z.string().max(1000), versionLabel: z.string().max(1000),
  location: z.string().max(1000).optional(), attendance: z.string().max(3000).optional(),
  recorder: z.string().max(1000).optional(), readAt: z.string().max(100).optional(),
}).strict();
export const importRevisionSchema = z.object({
  input: minutesSaveSchema, details: importDetailsSchema, sourceText: z.string().max(200000),
}).refine(d => !d.details.reportMissing || d.input.report === '', 'Een agenda is geen volledig verslag.');
export type ImportDetails = z.infer<typeof importDetailsSchema>;
export type ImportRevision = z.infer<typeof importRevisionSchema>;
export type ImportOriginal = { revision: ImportRevision; path: string; name: string; hash: string };
const docSchema = z.object({file_name:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),archive_path:z.string(),text:z.string(),source_path:z.string(),other_source_paths:z.array(z.string()).optional(),date_basis:z.string(),source_version_label:z.string()});
const manifestSchema = z.object({schema_version:z.literal(1),read_at:z.string(),excluded:z.array(z.unknown()),onedrive_meetings:z.array(z.object({source_id:z.string(),meeting_date:z.string(),meeting_type:z.enum(['bestuursvergadering','dagelijks-bestuur']),title:z.string(),status:z.literal('historisch-onbevestigd'),review_required:z.literal(true),documents:z.array(docSchema).min(1),display_text_source_sha256:z.string()})),topical_meetings:z.array(z.object({source_id:z.string(),source_url:z.string(),meeting_date:z.string(),title:z.string(),status:z.literal('historisch-onbevestigd'),review_required:z.literal(true),file_name:z.string(),sha256:z.string(),archive_path:z.string(),full_export_text:z.string(),summary_text:z.string(),has_summary:z.boolean()}))});
export async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',copy)), b=>b.toString(16).padStart(2,'0')).join('');
}
export async function prepareMinutesPackage(entries: Record<string,Uint8Array>) {
  const originals:ImportOriginal[]=[];
  const manifestBytes=entries['manifest.json'];
  if(!manifestBytes) throw new Error('manifest.json ontbreekt.');
  if(manifestBytes.length>10*1024*1024)throw new Error('Manifest is te groot.');
  const manifest=manifestSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes)));
  const seen=new Set<string>();
  const base=(source:'onedrive'|'topical',sourceId:string,date:string,title:string,report:string,hash:string,url='')=>({meetingId:null,expectedVersion:null,source,sourceId,date,title,report,decisions:[],actions:[],sourceUrl:url,fileHash:hash,confirm:true as const});
  for(const record of manifest.onedrive_meetings){
    const key=`onedrive:${record.source_id}`;if(seen.has(key))throw new Error('Dubbele bron-id in manifest.');seen.add(key);
    if(!record.documents.some(d=>d.sha256===record.display_text_source_sha256))throw new Error('Onbekende weergavebron.');
    const ordered=[...record.documents].sort((a,b)=>Number(a.sha256===record.display_text_source_sha256)-Number(b.sha256===record.display_text_source_sha256));
    for(const doc of ordered)originals.push({path:doc.archive_path,name:doc.file_name,hash:doc.sha256,revision:importRevisionSchema.parse({input:base('onedrive',record.source_id,record.meeting_date,record.title,doc.text,doc.sha256),sourceText:doc.text,details:{status:record.status,reviewRequired:true,reportMissing:!doc.text.trim(),meetingType:record.meeting_type,originalName:doc.file_name,sourcePaths:[doc.source_path,...(doc.other_source_paths??[])],dateBasis:doc.date_basis,versionLabel:doc.source_version_label,readAt:manifest.read_at}})});
  }
  for(const record of manifest.topical_meetings){
    const key=`topical:${record.source_id}`;if(seen.has(key))throw new Error('Dubbele bron-id in manifest.');seen.add(key);
    if(record.has_summary&&!record.summary_text.trim())throw new Error('Samenvatting ontbreekt ondanks bronmarkering.');
    originals.push({path:record.archive_path,name:record.file_name,hash:record.sha256,revision:importRevisionSchema.parse({input:base('topical',record.source_id,record.meeting_date,record.title,record.has_summary?record.summary_text:'',record.sha256,record.source_url),sourceText:record.full_export_text,details:{status:record.status,reviewRequired:true,reportMissing:!record.has_summary,meetingType:'bestuursvergadering',originalName:record.file_name,sourcePaths:[record.source_url],dateBasis:'manifest: datum uit Topical-export',versionLabel:'Volledige PDF-export',readAt:manifest.read_at}})});
  }
  for(const original of originals){
    if(!/^(originals\/onedrive|originals\/topical)\/[a-zA-Z0-9._-]+$/.test(original.path)||original.path.includes('..'))throw new Error('Onveilig bestandspad.');
    const bytes=entries[original.path];if(!bytes)throw new Error('Oorspronkelijk bestand ontbreekt.');
    validateMinutesBytes(original.name,bytes);
    if(await sha256(bytes)!==original.hash)throw new Error('Bestandhash wijkt af van manifest.');
  }
  return {originals,meetings:seen.size,excluded:manifest.excluded.length};
}

export function minutesStatus(adopted:boolean,details?:ImportDetails|null){
  return adopted?'Vastgesteld':details?.reportMissing?'Verslag ontbreekt':details?.status==='historisch-onbevestigd'?'Historisch – status te controleren':'Concept';
}