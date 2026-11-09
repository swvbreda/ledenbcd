import type { MinutesArchive } from './boardMinutes';
import type { ImportDetails } from './boardMinutesImport';

export const minutesReadTables=['meetings','versions','files','adoptions','imports'] as const;
export type MinutesReadTable=typeof minutesReadTables[number];
export type MinutesReadRow=MinutesArchive['meetings'][number]|MinutesArchive['versions'][number]|MinutesArchive['files'][number]|MinutesArchive['adoptions'][number]|{version_id:string;details:ImportDetails;source_text:string};
export type MinutesReadPage={rows:MinutesReadRow[];canManage:boolean};
export const minutesPageSize=(table:MinutesReadTable)=>table==='imports'||table==='versions'?10:100;
export async function boundedMinutesRead<T>(read:()=>Promise<T>,timeoutMs=20000):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Notulen laden duurt te lang; probeer opnieuw.')),timeoutMs);})]);}
  finally{if(timer)clearTimeout(timer);}
}
/** Small authenticated responses avoid serializing the full archive in one RPC. */
export async function readMinutesArchive(read:(table:MinutesReadTable,offset:number)=>Promise<MinutesReadPage>):Promise<MinutesArchive>{
  const archive:MinutesArchive={meetings:[],versions:[],files:[],adoptions:[],imports:[],canManage:false};
  await boundedMinutesRead(async()=>{
    await Promise.all(minutesReadTables.map(async table=>{
      const rows:unknown[]=[];
      for(let offset=0;offset<10000;){
        const page=await boundedMinutesRead(()=>read(table,offset));
        rows.push(...page.rows);archive.canManage=page.canManage;
        if(page.rows.length<minutesPageSize(table)){
          switch(table){
            case 'meetings':archive.meetings=rows as MinutesArchive['meetings'];break;
            case 'versions':archive.versions=rows as MinutesArchive['versions'];break;
            case 'files':archive.files=rows as MinutesArchive['files'];break;
            case 'adoptions':archive.adoptions=rows as MinutesArchive['adoptions'];break;
            case 'imports':archive.imports=rows as {version_id:string;details:ImportDetails;source_text:string}[];break;
          }
          return;
        }
        offset+=page.rows.length;
      }
      throw new Error('Notulenarchief overschrijdt de leeslimiet.');
    }));
  },90000);
  return archive;
}