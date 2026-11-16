import {freshBook} from './state.js';
import {put} from './db.js';
import {refresh,openBook} from './library.js';
import {toast} from './utils.js';

export async function importPDF(file){
 if(!file)return;
 if(!window.pdfjsLib)return alert('PDF reader library did not load. Check your connection and retry.');
 try{
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await window.pdfjsLib.getDocument({data}).promise;
  const pages=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
   const page=await pdf.getPage(pageNumber);
   const content=await page.getTextContent();
   let text='',lastY=null;
   for(const item of content.items){
    if(!item.str)continue;
    const y=item.transform?.[5];
    if(lastY!==null&&Number.isFinite(y)&&Math.abs(y-lastY)>2)text+='\n';
    else if(text&&!text.endsWith('\n'))text+=' ';
    text+=item.str;
    if(Number.isFinite(y))lastY=y;
   }
   pages.push(text.trim());
  }
  const extracted=pages.filter(Boolean).join('\n\n');
  if(!extracted)throw new Error('No selectable text was found. This PDF may be scanned or image-only.');
  const title=file.name.replace(/\.pdf$/i,'').trim()||'Imported PDF';
  const book=freshBook('pdf',title);
  const now=Date.now();book.chapters=[{title,text:extracted,images:[],createdAt:now,updatedAt:now,history:[]}];
  await put(book);
  await refresh();
  openBook(book.id);
  toast('PDF imported as one chapter');
 }catch(error){
  alert('Could not import PDF: '+(error?.message||error));
 }
}