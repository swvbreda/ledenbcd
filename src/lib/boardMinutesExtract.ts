/** Browser-only extraction; original bytes never change and text is never rendered as HTML. */
export async function extractMinutesText(file: File): Promise<string> {
  const ext=file.name.split('.').pop()?.toLowerCase();
  const buffer=await file.arrayBuffer();
  if(ext==='txt')return new TextDecoder('utf-8',{fatal:true}).decode(buffer).slice(0,200000);
  if(ext==='docx') {const mammoth=await import('mammoth');const result=await mammoth.extractRawText({arrayBuffer:buffer});return result.value.slice(0,200000);}
  if(ext==='pdf'){
    const pdfjs=await import('pdfjs-dist');
    const {default:worker}=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc=worker;
    const document=await pdfjs.getDocument({data:buffer,isEvalSupported:false}).promise;
    try{let text='';for(let i=1;i<=document.numPages&&text.length<200000;i++){const page=await document.getPage(i);const content=await page.getTextContent();text+=content.items.map(item=>'str' in item?item.str:'').join(' ')+'\n\n';}return text.slice(0,200000);}finally{await document.destroy();}
  }
  throw new Error('Het oorspronkelijke DOC-bestand blijft bewaard; voeg de verslagtekst handmatig toe.');
}