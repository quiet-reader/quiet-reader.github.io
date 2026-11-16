import {$,esc,toast,modal,closeModal} from './utils.js';
import {translateImageText,getImageTranslationSources} from './translation.js';

const overlays=new Map();
let worker=null,workerLanguage='';
export function clearImageTranslationOverlay(imageId){
 if(imageId)overlays.delete(imageId);else overlays.clear();
 const root=$('imageTranslationPanel');if(root){root.replaceChildren();root.hidden=true;}
}
export function renderImageTranslationOverlay(image){
 const root=$('imageTranslationPanel');
 if(!root)return;
 const text=overlays.get(image?.id)||'';
 root.replaceChildren();
 root.hidden=!text;
 if(!text)return;
 const details=document.createElement('details');
 details.className='image-translation-details';
 details.open=false;
 const summary=document.createElement('summary');
 summary.textContent='English translation · Expand';
 const content=document.createElement('div');
 content.className='image-translation-result';
 content.textContent=text;
 details.append(summary,content);
 
 root.append(details);
}
async function prepareOcrImage(data){
 const source=new Image();
 source.src=data;
 await new Promise((resolve,reject)=>{if(source.complete&&source.naturalWidth)resolve();else{source.onload=resolve;source.onerror=()=>reject(new Error('Could not prepare image for OCR.'))}});
 const scale=Math.min(2.5,2600/Math.max(source.naturalWidth,source.naturalHeight),Math.max(1,1800/Math.max(source.naturalWidth,source.naturalHeight)));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));
 canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
 const context=canvas.getContext('2d',{willReadFrequently:true});
 context.drawImage(source,0,0,canvas.width,canvas.height);
 const pixels=context.getImageData(0,0,canvas.width,canvas.height),values=pixels.data;
 for(let i=0;i<values.length;i+=4){
  const gray=values[i]*.299+values[i+1]*.587+values[i+2]*.114;
  const enhanced=Math.max(0,Math.min(255,(gray-128)*1.35+128));
  values[i]=values[i+1]=values[i+2]=enhanced;
 }
 context.putImageData(pixels,0,0);
 return canvas;
}
function cleanOcrLines(lines){
 const seen=new Set(),clean=[];
 for(const line of lines){
  const value=String(line.text||'').replace(/\s+/g,' ').trim();
  if(!value)continue;
  const key=value.replace(/[\s，。！？、,.!?]/g,'');
  if(seen.has(key))continue;
  seen.add(key);clean.push(value);
 }
 return clean;
}
export function openImageTranslation(image){
 const sources=getImageTranslationSources();
 if(!sources.length){toast('Add a Google, DeepL, or LibreTranslate API source in Translation sources first');return}
 const viewer=document.querySelector('#modalHost .image-viewer-modal');
 if(!viewer){toast('Fullscreen image viewer is not open');return}
 viewer.querySelector('.image-translation-dialog')?.remove();
 const options=sources.map(source=>'<option value="'+esc(source.id)+'">'+esc(source.name)+'</option>').join('');
 const dialog=document.createElement('div');
 dialog.className='image-translation-dialog';
 dialog.innerHTML='<section class="image-translation-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="imageTranslationTitle"><div class="row between"><h2 id="imageTranslationTitle">Translate image</h2><button type="button" data-image-translation-close aria-label="Close">×</button></div><div class="stack"><p class="muted tiny">OCR runs in your browser. Detected text is sent to the selected translation provider and displayed over the original text. Translation target is always English.</p><label>Text language<select id="imageOcrLanguage"><option value="jpn">Japanese</option><option value="chi_sim">Chinese (Simplified)</option><option value="chi_tra">Chinese (Traditional)</option><option value="kor">Korean</option></select></label><label>Translation source<select id="imageTranslationSource">'+options+'</select></label><div id="imageTranslationProgress" class="muted tiny" aria-live="polite">Ready</div><div class="row"><span class="grow"></span><button type="button" data-start-image-translation class="primary">Detect &amp; translate</button></div></div></section>';
 viewer.append(dialog);
 const dismiss=()=>dialog.remove();
 dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-image-translation-close]'))dismiss()});
 dialog.querySelector('[data-start-image-translation]').onclick=async()=>{
  const button=dialog.querySelector('[data-start-image-translation]'),progress=dialog.querySelector('#imageTranslationProgress'),language=dialog.querySelector('#imageOcrLanguage').value,sourceId=dialog.querySelector('#imageTranslationSource').value;
  button.disabled=true;progress.textContent='Loading OCR engine…';
  try{
   const module=await import('https://esm.sh/tesseract.js@5.1.1');
   if(!worker||workerLanguage!==language){if(worker)await worker.terminate();worker=await module.createWorker(language,1,{logger:event=>{if(event.status)progress.textContent='OCR: '+event.status+(event.progress?' '+Math.round(event.progress*100)+'%':'')}});workerLanguage=language}
   progress.textContent='Preparing image for clearer text recognition…';
   const prepared=await prepareOcrImage(image.data);
   await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
   progress.textContent='Recognizing text…';
   const result=await worker.recognize(prepared);
   const detected=cleanOcrLines(result.data.lines||[]);
   if(!detected.length)throw new Error('No text detected. Try another language or a clearer image.');
   progress.textContent='Translating '+detected.length+' detected text lines to English…';
   // Chinese and Japanese sentence flow is often split across visual lines.
   // Join adjacent OCR lines so the provider can translate in context.
   const joined=detected.join(language.startsWith('chi')?'':'\n');
   const translated=await translateImageText(joined,sourceId);
   if(!translated.trim())throw new Error('The translation provider returned empty text. Try another source.');
   overlays.set(image.id,translated.trim());
   dismiss();renderImageTranslationOverlay(image);toast('Image translated · '+detected.length+' detected lines');
  }catch(error){progress.textContent=error.message||'Image translation failed';button.disabled=false}
 };
}
