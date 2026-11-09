import type { MinutesArchive } from './boardMinutes';

export function historicalAdoptionPlan(archive: MinutesArchive) {
  const targets:string[]=[], exceptions:{date:string;reason:string}[]=[];
  for(const meeting of archive.meetings){
    const latest=archive.versions.filter(v=>v.meeting_id===meeting.id).sort((a,b)=>b.version-a.version)[0];
    if(!latest)continue;
    const details=archive.imports?.find(d=>d.version_id===latest.id)?.details;
    if(latest.meeting_date>='2026-11-06'){
      exceptions.push({date:latest.meeting_date,reason:'Concept behouden; buiten historische correctie'});continue;
    }
    if(!['onedrive','topical'].includes(meeting.source)||details?.status!=='historisch-onbevestigd')continue;
    if(details.reportKind==='agenda-only'||details.reportMissing||(meeting.source==='topical'&&latest.meeting_date==='2026-06-04')||!latest.report.trim()){
      exceptions.push({date:latest.meeting_date,reason:'Agenda / verslag ontbreekt; niet vaststellen'});continue;
    }
    if(archive.adoptions.some(a=>a.version_id===latest.id))continue;
    if(!archive.files.some(f=>f.version_id===latest.id)){
      exceptions.push({date:latest.meeting_date,reason:'Oorspronkelijk bestand ontbreekt; niet vaststellen'});continue;
    }
    targets.push(latest.id);
  }
  return {targets:targets.sort(),exceptions};
}