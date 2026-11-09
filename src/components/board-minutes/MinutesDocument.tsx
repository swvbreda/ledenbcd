import type { MinuteVersion } from '@/lib/boardMinutes';
import type { ImportDetails } from '@/lib/boardMinutesImport';
import { minutesDisplayReport } from '@/lib/boardMinutesImport';
import { MinutesActions } from './MinutesActions';
import './minutes-document.css';

export function MinutesDocument({version,details,status}:{version:MinuteVersion;details?:ImportDetails;status:string}){
  const paragraphs=minutesDisplayReport(version.report,details).split(/\n\s*\n/);
  return <article className="minutes-document" aria-label="Afdrukweergave notulen">
    <h1>{version.title}</h1>
    <dl><dt>Datum</dt><dd>{version.meeting_date}</dd><dt>Status</dt><dd>{status}</dd>
      {details?.location&&<><dt>Locatie</dt><dd>{details.location}</dd></>}
      <dt>Aanwezig</dt><dd>{details?.attendance||'Niet bekend'}</dd>
      {details?.recorder&&<><dt>Verslag</dt><dd>{details.recorder}</dd></>}
    </dl>
    {details?.reportKind==='ai-report'&&<p><strong>AI-verslag</strong></p>}
    {details?.reportKind==='brief-notes'&&<p><strong>Beknopte notities</strong></p>}
    {details?.metadata?.length? <section aria-label="Aangeleverde vergadergegevens"><h2>Vergadergegevens</h2>{details.metadata.filter(text=>!details.attendance||!/^\s*(?:aanwezig(?:en)?|aanwezige deelnemers)\s*:/i.test(text)).map((text,i)=><p key={i} className="whitespace-pre-wrap break-words">{text}</p>)}</section>:null}
    {details?.sourceWarning&&<details className="minutes-no-print"><summary>Broncontrole</summary><p>{details.sourceWarning}</p></details>}
    {details?.sourcePaths.length? <details className="minutes-no-print"><summary>Bronverwijzingen</summary>{details.sourcePaths.map((path,i)=><p key={i} className="break-all">{path}</p>)}<p>{details.dateBasis}</p><p>{details.versionLabel}</p></details>:null}
    {details?.reportMissing?<p>Verslag ontbreekt</p>:details?.sections!==undefined?details.sections.map((section,i)=><section key={i}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph,j)=><p key={j} className="whitespace-pre-wrap break-words">{paragraph}</p>)}</section>):paragraphs.map((text,i)=><p key={i} className="whitespace-pre-wrap break-words">{text.split('\n').map((line,j)=>{const heading=line.trim().length>0&&line.length<100&&!/[.!?;:]$/.test(line.trim())&&(j===0||text.split('\n').length===1);return <span key={j}>{j>0&&<br/>}{heading?<strong>{line}</strong>:line}</span>;})}</p>)}
    <h2>Besluiten</h2>{version.decisions.length?<ol>{version.decisions.map((d,i)=><li key={i}>{d}</li>)}</ol>:<p>Geen afzonderlijk geregistreerde besluiten; raadpleeg de oorspronkelijke bron.</p>}
    <h2>Acties</h2><MinutesActions rows={details?.action_rows} actions={version.actions}/>
  </article>;
}