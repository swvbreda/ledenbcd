import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { downloadMinutesBlob, MINUTES_BUCKET, type MinuteFile } from '@/lib/boardMinutes';

/** Preparation and saving are separate clicks so Safari keeps user activation. */
export function MinutesDownload({file,onError}:{file:MinuteFile;onError:(message:string)=>void}) {
  const [blob,setBlob]=useState<Blob|null>(null);const[loading,setLoading]=useState(false);
  async function prepare(){if(loading)return;setLoading(true);onError('');try{const{data,error}=await supabase.storage.from(MINUTES_BUCKET).download(file.path);if(error||!data)throw new Error('Bestand niet toegankelijk of downloaden mislukt.');setBlob(data);}catch(e){onError(e instanceof Error?e.message:'Download mislukt.');}finally{setLoading(false);}}
  async function save(){if(!blob)return;const document=new File([blob],file.original_name,{type:blob.type});if(matchMedia('(pointer: coarse)').matches&&navigator.canShare?.({files:[document]})){try{await navigator.share({files:[document],title:file.original_name});return;}catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;}}downloadMinutesBlob(blob,file.original_name);}
  return blob?<Button variant="outline" size="sm" onClick={save}><Download size={16}/>Bestand opslaan</Button>:<Button size="icon" variant="outline" disabled={loading} aria-label={`Download ${file.original_name}`} title={`Download ${file.original_name}`} onClick={prepare}>{loading?<LoaderCircle size={16} className="animate-spin motion-reduce:animate-none"/>:<Download size={16}/>}</Button>;
}