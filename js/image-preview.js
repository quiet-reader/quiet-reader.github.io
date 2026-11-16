import {$,esc,modal,closeModal,dataURL} from './utils.js';
export async function confirmImagePreview(input,{title='Preview image',confirmLabel='Add image'}={}){
 const files=(Array.isArray(input)?input:[input]).filter(Boolean);
 if(!files.length)return false;
 const previews=await Promise.all(files.map(async file=>({file,url:await dataURL(file)})));
 return new Promise(resolve=>{
  let settled=false;
  const finish=value=>{if(settled)return;settled=true;closeModal();resolve(value)};
  const formatSize=bytes=>bytes<1024?bytes+' B':bytes<1024*1024?(bytes/1024).toFixed(1)+' KB':(bytes/1024/1024).toFixed(2)+' MB';
  const body='<div class="image-import-preview"><div class="image-import-preview-grid">'+previews.map(item=>'<figure><img src="'+item.url+'" alt="'+esc(item.file.name||'Pasted image')+'"><figcaption><b>'+esc(item.file.name||'Pasted image')+'</b><span>'+esc(formatSize(item.file.size||0))+'</span></figcaption></figure>').join('')+'</div><p class="muted tiny">'+previews.length+' image'+(previews.length===1?'':'s')+' selected. Nothing will be added until you confirm.</p><div class="row wrap"><button type="button" id="cancelImageImport">Cancel</button><span class="grow"></span><button type="button" id="confirmImageImport" class="primary">'+esc(confirmLabel)+'</button></div></div>';
  modal(title,body,()=>{
   $('modalClose').onclick=()=>finish(false);
   $('cancelImageImport').onclick=()=>finish(false);
   $('confirmImageImport').onclick=()=>finish(true);
   $('modalBack').addEventListener('click',event=>{if(event.target.id==='modalBack')finish(false)});
  });
 });
}
