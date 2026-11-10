import { z } from 'zod';
import { minutesSaveSchema, validateMinutesBytes, type MinutesArchive } from './boardMinutes';
import { minuteActionRowsSchema } from './boardMinutesTasks';
import { MINUTES_CATEGORY_IDS, type MinutesCategory } from './boardMinutesCategories';

export const importDetailsSchema = z.object({
  status: z.enum(['historisch-onbevestigd', 'concept']), reviewRequired: z.literal(true),
  reportMissing: z.boolean(), meetingType: z.enum(['bestuursvergadering', 'dagelijks-bestuur', 'gespreksverslag']),
  originalName: z.string().max(255), sourcePaths: z.array(z.string().max(2000)).max(100),
  dateBasis: z.string().max(1000), versionLabel: z.string().max(1000),
  location: z.string().max(1000).optional(), attendance: z.string().max(3000).optional(),
  recorder: z.string().max(1000).optional(), readAt: z.string().max(100).optional(),
  reportKind: z.enum(['summary', 'ai-report', 'brief-notes', 'agenda-only', 'source-review']).optional(),
  sourceWarning: z.string().max(1000).optional(),
  metadata: z.array(z.string().max(3000)).max(30).optional(),
  originalSourceSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  formatted: z.literal(true).optional(), formattedFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  action_rows: minuteActionRowsSchema.optional(),
  sections: z.array(z.object({ heading:z.string().max(1000), paragraphs:z.array(z.string().max(20000)).max(200) }).strict()).max(100).optional(),
}).strict();
export const importRevisionSchema = z.object({
  input: minutesSaveSchema, details: importDetailsSchema, sourceText: z.string().max(200000),
}).refine(d => !d.details.reportMissing || d.input.report === '', 'Een agenda is geen volledig verslag.');
export type ImportDetails = z.infer<typeof importDetailsSchema>;
export type ImportRevision = z.infer<typeof importRevisionSchema>;
export type ReportPlacement = { category: MinutesCategory; subcategory: string | null; year: number | null; dateKnown: boolean };
export type ImportOriginal = { revision: ImportRevision; path: string; name: string; hash: string; placement?: ReportPlacement };
const reportCategory = z.enum(MINUTES_CATEGORY_IDS).refine(c => c !== 'bestuursvergaderingen', 'Bestuursnotulen gebruiken het bestuursarchief.');
/** Contract for conversation reports (gespreksverslagen); see src/components/board-minutes/AGENTS.md. */
export const reportManifestSchema = z.object({ schema_version: z.literal(1), kind: z.literal('gespreksverslagen'), read_at: z.string().max(100),
  records: z.array(z.object({
    source_id: z.string().regex(/^verslag:[A-Za-z0-9._:-]{1,200}$/), category: reportCategory, subcategory: z.string().trim().min(1).max(120).nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), year: z.number().int().min(1990).max(2100).nullable(), title: z.string().trim().min(1).max(300),
    report: z.string().max(200000).default(''),
    documents: z.array(z.object({ archive_path: z.string().max(200).regex(/^verslagen\/[A-Za-z0-9._ -]{1,150}\.(pdf|docx|doc|txt)$/), file_name: z.string().max(255), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(20),
  }).strict().superRefine((r, ctx) => {
    if (r.date && r.year !== null && Number(r.date.slice(0, 4)) !== r.year) ctx.addIssue({ code: 'custom', message: 'Jaar wijkt af van datum.' });
    if (r.subcategory && r.category !== 'gemeenten') ctx.addIssue({ code: 'custom', message: 'Subcategorie alleen bij Gemeenten.' });
  })).min(1).max(1000) }).strict();
async function prepareReportPackage(entries: Record<string, Uint8Array>, raw: unknown) {
  const manifest = reportManifestSchema.parse(raw), originals: ImportOriginal[] = [], seen = new Set<string>(), paths = new Set<string>();
  for (const r of manifest.records) {
    if (seen.has(r.source_id)) throw new Error('Dubbele bron-id in manifest.'); seen.add(r.source_id);
    const dateKnown = !!r.date, year = r.date ? Number(r.date.slice(0, 4)) : r.year;
    // Unknown dates use a hidden technical placeholder; the UI shows "Datum onbekend".
    const date = r.date ?? `${year ?? 1900}-01-01`;
    const fileHash = await sha256(new TextEncoder().encode(JSON.stringify(r)));
    const revision = importRevisionSchema.parse({ input: { meetingId: null, expectedVersion: null, source: 'onedrive', sourceId: r.source_id, date, title: r.title, report: r.report, decisions: [], actions: [], sourceUrl: '', fileHash, confirm: true },
      sourceText: r.report, details: { status: 'historisch-onbevestigd', reviewRequired: true, reportMissing: false, meetingType: 'gespreksverslag', originalName: r.documents[0].file_name, sourcePaths: r.documents.map(d => d.archive_path),
        dateBasis: dateKnown ? 'Aangeleverd manifest' : 'Datum onbekend in bron', versionLabel: 'Gespreksverslag', readAt: manifest.read_at, ...(r.report ? {} : { reportKind: 'source-review' as const, sourceWarning: 'Inhoud staat in het oorspronkelijke bronbestand.' }) } });
    for (const d of r.documents) {
      if (paths.has(d.archive_path)) throw new Error('Dubbel bestandspad.'); paths.add(d.archive_path);
      const bytes = entries[d.archive_path]; if (!bytes) throw new Error('Oorspronkelijk bestand ontbreekt.');
      validateMinutesBytes(d.file_name, bytes);
      if (await sha256(bytes) !== d.sha256) throw new Error('Bestandhash wijkt af van manifest.');
      originals.push({ path: d.archive_path, name: d.file_name, hash: d.sha256, revision, placement: { category: r.category, subcategory: r.subcategory ?? null, year, dateKnown } });
    }
  }
  if (Object.keys(entries).some(p => !p.endsWith('/') && p !== 'manifest.json' && !paths.has(p))) throw new Error('Onverwacht bestand in verslagenpakket.');
  return { originals, meetings: seen.size, excluded: 0, formatted: false, reports: true };
}
export function bindFormattedRevisions(originals:ImportOriginal[],archive:MinutesArchive){
  return originals.map(original=>{
    if(!original.revision.details.formatted)return original;
    const r=original.revision;
    const meeting=archive.meetings.find(m=>m.source==='topical'&&m.source_id===r.input.sourceId);
    if(!meeting)throw new Error('Bestaande Topical-vergadering niet gevonden; historische import eerst afronden.');
    const versions=archive.versions.filter(v=>v.meeting_id===meeting.id).sort((a,b)=>b.version-a.version),latest=versions[0];
    if(!latest||!versions.some(v=>v.meeting_date===r.input.date))throw new Error('Vergaderdatum wijkt af van historische bron.');
    if(!archive.files.some(f=>versions.some(v=>v.id===f.version_id)&&f.sha256===r.details.originalSourceSha256&&f.path.endsWith('.pdf')))throw new Error('Oorspronkelijke PDF-bron ontbreekt of hash wijkt af.');
    return {...original,revision:{...r,input:{...r.input,meetingId:meeting.id,expectedVersion:latest.id}}};
  });
}
const docSchema = z.object({file_name:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),archive_path:z.string(),text:z.string(),source_path:z.string(),other_source_paths:z.array(z.string()).optional(),date_basis:z.string(),source_version_label:z.string()});
const manifestSchema = z.object({schema_version:z.literal(1),read_at:z.string(),excluded:z.array(z.unknown()),onedrive_meetings:z.array(z.object({source_id:z.string(),meeting_date:z.string(),meeting_type:z.enum(['bestuursvergadering','dagelijks-bestuur']),title:z.string(),status:z.literal('historisch-onbevestigd'),review_required:z.literal(true),documents:z.array(docSchema).min(1),display_text_source_sha256:z.string()})),topical_meetings:z.array(z.object({source_id:z.string(),source_url:z.string(),meeting_date:z.string(),title:z.string(),status:z.literal('historisch-onbevestigd'),review_required:z.literal(true),file_name:z.string(),sha256:z.string(),archive_path:z.string(),full_export_text:z.string(),summary_text:z.string(),has_summary:z.boolean()}))});
export const formattedManifestSchema=z.object({schema_version:z.literal(2),kind:z.literal('topical-formatted'),read_at:z.string().max(100),topical_formatted:z.array(z.object({
  source_id:z.string().regex(/^topical:[a-zA-Z0-9_-]{1,100}$/),meeting_date:z.string(),title:z.string(),metadata:z.array(z.string().max(3000)).max(30),report:z.string().max(200000),
  decisions:z.array(z.string().max(3000)).max(200),actions:z.array(z.string().max(3000)).max(200),source_url:z.string().max(2000),original_source_sha256:z.string().regex(/^[a-f0-9]{64}$/),
  report_kind:z.enum(['summary','ai-report','brief-notes','agenda-only']),documents:z.array(z.object({archive_path:z.string().max(150).regex(/^formatted\/[a-zA-Z0-9_-]{1,100}\.(docx|pdf)$/),file_name:z.string().max(255),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).length(2),
}).strict()).length(13)}).strict();
export function validatePackageEntries(entries:Record<string,Uint8Array>){
  if(Object.keys(entries).length>1000)throw new Error('Te veel pakketbestanden.');
  let total=0;
  for(const [path,bytes] of Object.entries(entries)){
    if(path.length>255||path.startsWith('/')||path.split('/').some(p=>p==='..'||p==='.')||/[\\\u0000-\u001f\u007f]/.test(path))throw new Error('Onveilig bestandspad.');
    total+=bytes.length;if(bytes.length>20*1024*1024||total>250*1024*1024)throw new Error('Uitgepakt pakket is te groot.');
  }
}
async function prepareFormattedPackage(entries:Record<string,Uint8Array>,raw:unknown){
  const manifest=formattedManifestSchema.parse(raw),originals:ImportOriginal[]=[],seen=new Set<string>(),paths=new Set<string>();
  for(const r of manifest.topical_formatted){
    if(seen.has(r.source_id))throw new Error('Dubbele bron-id in manifest.');seen.add(r.source_id);
    const id=r.source_id.slice('topical:'.length);
    if(!r.documents.some(d=>d.archive_path===`formatted/${id}.docx`)||!r.documents.some(d=>d.archive_path===`formatted/${id}.pdf`))throw new Error('Elke vergadering vereist één bijpassende DOCX en PDF.');
    const reportMissing=r.report_kind==='agenda-only';
    // For agenda-only the supplied report is agenda source text, never minutes.
    const sourceText=[...r.metadata,r.report].join('\n\n');
    const fileHash=await sha256(new TextEncoder().encode(JSON.stringify(r)));
    const revision=importRevisionSchema.parse({input:{meetingId:null,expectedVersion:null,source:'topical',sourceId:r.source_id,date:r.meeting_date,title:r.title,report:reportMissing?'':r.report,decisions:r.decisions,actions:r.actions,sourceUrl:r.source_url,fileHash,confirm:true},sourceText,details:{status:'historisch-onbevestigd',reviewRequired:true,reportMissing,reportKind:r.report_kind,formatted:true,originalSourceSha256:r.original_source_sha256,metadata:r.metadata,attendance:'Te controleren; genodigden zijn geen bevestigde aanwezigen.',meetingType:'bestuursvergadering',originalName:'Gestandaardiseerde DOCX/PDF',sourcePaths:[r.source_url],dateBasis:'Aangeleverd opmaakmanifest; datum te controleren',versionLabel:'Gestandaardiseerde Topical-weergave',readAt:manifest.read_at,...(r.report_kind==='ai-report'?{sourceWarning:'AI-verslag: bron en status te controleren; organisatieaanduiding en deelnemersinformatie zijn tegenstrijdig. Genodigden zijn geen bevestigde aanwezigen.'}:r.report_kind==='brief-notes'?{sourceWarning:'Beknopte notities; geen volledig verslag. Historische acties worden niet opnieuw geactiveerd.'}:{})}});
    for(const d of r.documents){
      if(paths.has(d.archive_path))throw new Error('Dubbel bestandspad.');paths.add(d.archive_path);
      const bytes=entries[d.archive_path];if(!bytes)throw new Error('Oorspronkelijk bestand ontbreekt.');
      const type=validateMinutesBytes(d.file_name,bytes);if(!d.archive_path.endsWith(`.${type.ext}`))throw new Error('Bestandstype wijkt af van pad.');
      if(await sha256(bytes)!==d.sha256)throw new Error('Bestandhash wijkt af van manifest.');
      originals.push({path:d.archive_path,name:d.file_name,hash:d.sha256,revision});
    }
  }
  if(Object.keys(entries).some(p=>!p.endsWith('/')&&p!=='manifest.json'&&!paths.has(p)))throw new Error('Onverwacht bestand in opmaakpakket.');
  return {originals,meetings:seen.size,excluded:0,formatted:true};
}
export async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',copy)), b=>b.toString(16).padStart(2,'0')).join('');
}
// Absence of the technical summary heading does not establish absence of minutes.
export function topicalReport(record: {meeting_date:string;has_summary:boolean;summary_text:string;full_export_text:string}) {
  const text=record.full_export_text;
  if(record.has_summary){
    if(!record.summary_text.trim())throw new Error('Samenvatting ontbreekt ondanks bronmarkering.');
    return {report:record.summary_text,reportMissing:false,reportKind:'summary' as const};
  }
  const aiHeading=/^AI-verslag\s*$/m.exec(text);
  if(aiHeading){
    const tail=text.slice(aiHeading.index+aiHeading[0].length);
    const end=/^Notulen\s*$/m.exec(tail);
    const report=(end?tail.slice(0,end.index):tail).trim();
    if(report)return {report,reportMissing:false,reportKind:'ai-report' as const,sourceWarning:'AI-verslag: bron en status te controleren; organisatieaanduiding en deelnemersinformatie zijn tegenstrijdig. Genodigden zijn geen bevestigde aanwezigen.'};
  }
  if(record.meeting_date==='2026-06-04')return {report:'',reportMissing:true,reportKind:'agenda-only' as const};
  const heading=/^Notulen\s*$/m.exec(text);
  const report=heading?text.slice(heading.index+heading[0].length).trim():text.trim();
  if(record.meeting_date==='2026-05-07'&&report)return {report,reportMissing:false,reportKind:'brief-notes' as const,sourceWarning:'Beknopte inhoudelijke notities met één historische actie in de bron; geen volledig verslag. Genodigden zijn geen bevestigde aanwezigen.'};
  return {report,reportMissing:false,reportKind:'source-review' as const,sourceWarning:'Volledige bron te controleren: het ontbreken van de kop Samenvatting bewijst niet dat verslagtekst ontbreekt.'};
}
export async function prepareMinutesPackage(entries: Record<string,Uint8Array>) {
  validatePackageEntries(entries);
  const originals:ImportOriginal[]=[];
  const manifestBytes=entries['manifest.json'];
  if(!manifestBytes){
    const json=entries['verslag.json'],txt=entries['verslag.txt'];
    if(!json||!txt)throw new Error('manifest.json ontbreekt.');
    const concept=z.object({title:z.string(),metadata:z.array(z.string()),decisions:z.array(z.string()),actions:z.array(z.string()),action_rows:minuteActionRowsSchema.optional(),sections:importDetailsSchema.shape.sections}).parse(JSON.parse(new TextDecoder().decode(json)));
    const text=new TextDecoder('utf-8',{fatal:true}).decode(txt);
    const attachments=Object.entries(entries).filter(([name])=>/\.(pdf|docx)$/i.test(name));
    if(attachments.length!==2||!attachments.some(([n])=>n.endsWith('.pdf'))||!attachments.some(([n])=>n.endsWith('.docx')))throw new Error('Concept vereist originele PDF en DOCX.');
    const hash=await sha256(json);
    const decisions=concept.decisions.filter(d=>!/^te bevestigen:/i.test(d));
    const report=concept.sections ? concept.sections.map(s=>[s.heading,...s.paragraphs].join('\n\n')).join('\n\n') : text;
    const attendance=concept.metadata.find(m=>/^Aanwezig\s*:/i.test(m))?.replace(/^Aanwezig\s*:\s*/i,'');
    for(const [name,bytes]of attachments){validateMinutesBytes(name,bytes);const fileHash=await sha256(bytes);originals.push({path:name,name,hash:fileHash,revision:importRevisionSchema.parse({input:{meetingId:null,expectedVersion:null,source:'upload',sourceId:'handmatig:2026-11-06:bestuur',date:'2026-11-06',title:concept.title,report,decisions,actions:concept.actions,sourceUrl:'',fileHash:hash,confirm:true},sourceText:text,details:{status:'concept',reviewRequired:true,reportMissing:false,meetingType:'bestuursvergadering',originalName:'Conceptpakket DOCX/PDF',sourcePaths:[],dateBasis:'Aangeleverd concept 6 november 2026',versionLabel:'Concept',attendance,metadata:concept.metadata,action_rows:concept.action_rows,sections:concept.sections,recorder:'Secretariaat'}})});}
    return {originals,meetings:1,excluded:0};
  }
  if(manifestBytes.length>10*1024*1024)throw new Error('Manifest is te groot.');
  const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));
  if(raw.schema_version===2)return prepareFormattedPackage(entries,raw);
  if(raw.kind==='gespreksverslagen')return prepareReportPackage(entries,raw);
  const manifest=manifestSchema.parse(raw);
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
    const {report,...reportDetails}=topicalReport(record);
    originals.push({path:record.archive_path,name:record.file_name,hash:record.sha256,revision:importRevisionSchema.parse({input:base('topical',record.source_id,record.meeting_date,record.title,report,record.sha256,record.source_url),sourceText:record.full_export_text,details:{status:record.status,reviewRequired:true,...reportDetails,meetingType:'bestuursvergadering',originalName:record.file_name,sourcePaths:[record.source_url],dateBasis:'manifest: datum uit Topical-export',versionLabel:'Volledige PDF-export',readAt:manifest.read_at}})});
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
  return details?.meetingType==='gespreksverslag'&&!adopted?'Gespreksverslag':adopted?'Vastgesteld':details?.reportMissing?'Verslag ontbreekt':details?.reportKind==='brief-notes'?'Beknopte notities – status te controleren':details?.status==='historisch-onbevestigd'?'Historisch – status te controleren':'Concept';
}