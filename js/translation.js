import { $, esc, toast, modal, closeModal } from './utils.js';
import { state } from './state.js';
import { chapterHTML } from './reader.js';
import { renderHighlights } from './highlights.js';

const STORAGE_KEY='qrTranslationSources';
let translated={bookId:null,chapter:null,text:null};

function sources(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return []}}
function saveSources(list){localStorage.setItem(STORAGE_KEY,JSON.stringify(list))}
function sourceTypeLabel(type){return ({google:'Google Cloud Translation API',googleFree:'Google Translate (free, unofficial)',deepl:'DeepL',libre:'LibreTranslate / local',omni:'OmniTranslate (manual handoff)'})[type]||type}
function sourceEditor(source=null){
 const current=source||{id:'src-'+Date.now(),type:'googleFree',name:'Google Translate Free',endpoint:'',apiKey:'',defaultTarget:'en'};
 const body='<div class="stack translation-source-form">'+
 '<label>Source name<input id="trSourceName" value="'+esc(current.name)+'" placeholder="My translation source"></label>'+
 '<label>Provider<select id="trSourceType"><option value="googleFree">Google Translate (free, unofficial)</option><option value="google">Google Cloud Translation API (key required)</option><option value="deepl">DeepL API</option><option value="libre">LibreTranslate / local server</option><option value="omni">OmniTranslate (manual handoff)</option></select></label>'+
 '<label id="trEndpointWrap">API endpoint<input id="trEndpoint" value="'+esc(current.endpoint||'')+'" placeholder="http://localhost:5000"></label>'+
 '<label>API key (if required)<input id="trApiKey" type="password" autocomplete="off" value="'+esc(current.apiKey||'')+'" placeholder="API key"></label>'+
 '<label>Default target language<input id="trTarget" value="'+esc(current.defaultTarget||'en')+'" placeholder="en, zh-CN, ja…"></label>'+
 '<p class="muted tiny">API keys and source settings are stored only in this browser. A browser-based app must send the key to the provider directly; use a local/self-hosted service if you do not want a third party key stored here.</p>'+
 '<div class="row"><span class="grow"></span><button id="trSaveSource" class="primary">Save source</button></div></div>';
 modal(source?'Edit translation source':'Create translation source',body,()=>{
  $('trSourceType').value=current.type;
  const endpoint=$('trEndpointWrap');
  const update=()=>{const type=$('trSourceType').value;endpoint.classList.toggle('hidden',type==='google'||type==='googleFree'||type==='omni');$('trEndpoint').placeholder=type==='deepl'?'https://api-free.deepl.com/v2/translate':'http://localhost:5000';};
  $('trSourceType').onchange=update;update();
  $('trSaveSource').onclick=()=>{
   const type=$('trSourceType').value,name=$('trSourceName').value.trim();
   if(!name)return toast('Enter a source name');
   const list=sources(),item={id:current.id,type,name,endpoint:$('trEndpoint').value.trim(),apiKey:$('trApiKey').value.trim(),defaultTarget:$('trTarget').value.trim()||'en'};
   const index=list.findIndex(x=>x.id===current.id);if(index>=0)list[index]=item;else list.push(item);
   saveSources(list);closeModal();manageTranslationSources();toast('Translation source saved');
  };
 });
}
export function manageTranslationSources(){
 const list=sources();
 const rows=list.length?list.map(s=>'<div class="translation-source-row"><div class="grow"><b>'+esc(s.name)+'</b><div class="muted tiny">'+esc(sourceTypeLabel(s.type))+' · target '+esc(s.defaultTarget||'en')+'</div></div><button type="button" data-edit-source="'+esc(s.id)+'">Edit</button><button type="button" class="danger" data-delete-source="'+esc(s.id)+'">Delete</button></div>').join(''):'<p class="muted tiny">No sources configured yet. Add Google Cloud Translation, DeepL, or a local LibreTranslate-compatible server.</p>';
 modal('Translation sources','<div class="stack"><p class="muted tiny">Choose which translation service to use when translating a whole chapter. Local services must be reachable from this browser and allow CORS requests.</p><div class="translation-source-list">'+rows+'</div><button id="trAddSource" class="primary">＋ Create source</button></div>',()=>{
  $('trAddSource').onclick=()=>sourceEditor();
  $('modalHost').onclick=e=>{
   const edit=e.target.closest('[data-edit-source]'),del=e.target.closest('[data-delete-source]');
   if(edit){const s=sources().find(x=>x.id===edit.dataset.editSource);if(s)sourceEditor(s)}
   if(del){saveSources(sources().filter(x=>x.id!==del.dataset.deleteSource));manageTranslationSources()}
  };
 });
}
function translationMarkup(text){
 const chapter=state.book?.chapters?.[state.chapter];if(!chapter)return;
 $('readingBody').innerHTML=chapterHTML({...chapter,text});
 $('readingBody').classList.remove('hidden');$('sectionView').classList.add('hidden');
 $('chapterFormatControls').querySelectorAll('[data-chapter-format]').forEach(button=>button.disabled=true);
}
function updateControls(){
 const active=translated.bookId===state.book?.id&&translated.chapter===state.chapter&&translated.originalText===state.book?.chapters?.[state.chapter]?.text&&typeof translated.text==='string';
 const show=$('restoreTranslation'),copy=$('copyTranslatedChapter');
 if(show)show.classList.toggle('hidden',!active);
 if(copy)copy.classList.toggle('hidden',!active);
 const button=$('translateChapter');if(button){button.textContent=active?'Translated':'Translate page';button.disabled=false}
}
export function restoreOriginalChapter(){
 if(translated.bookId!==state.book?.id||translated.chapter!==state.chapter||translated.originalText!==state.book?.chapters?.[state.chapter]?.text)return;
 translated={bookId:null,chapter:null,text:null};
 const c=state.book.chapters[state.chapter];$('readingBody').innerHTML=chapterHTML(c);
 $('chapterFormatControls').querySelectorAll('[data-chapter-format]').forEach(button=>button.disabled=false);
 renderHighlights();updateControls();
}
export async function copyTranslatedChapter(){
 if(translated.bookId!==state.book?.id||translated.chapter!==state.chapter||translated.originalText!==state.book?.chapters?.[state.chapter]?.text||typeof translated.text!=='string')return toast('Translate this chapter first');
 try{await navigator.clipboard.writeText(translated.text);toast('Translated chapter copied')}catch{const ta=document.createElement('textarea');ta.value=translated.text;document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();toast(ok?'Translated chapter copied':'Could not copy translated chapter')}
}
async function translateWith(source,text,target){
 const count=[...text].length;
 if(source.type==='googleFree'){
  // Use a form-encoded POST so the chapter is sent in the request body,
  // not embedded in a potentially enormous URL. This is still an
  // undocumented Google web endpoint, not the supported Cloud API.
  const params=new URLSearchParams({client:'gtx',sl:'auto',tl:target,dt:'t',q:text});
  let response;
  try{
   response=await fetch('https://translate.googleapis.com/translate_a/single',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:params.toString(),credentials:'omit'});
  }catch(error){
   throw new Error('Google Translate Free could not be reached. The unofficial endpoint may be blocked by Google, your browser, or your network (CORS/network failure). Try again, or use another source. No chunks were sent.');
  }
  const raw=await response.text();
  if(!response.ok)throw new Error('Google Translate Free rejected the request (HTTP '+response.status+'). The public endpoint may be rate-limiting or blocking this network. No chunks were sent.');
  let data;try{data=JSON.parse(raw)}catch{throw new Error('Google Translate Free returned an unreadable response (possibly a block or CAPTCHA page). No chunks were sent.')}
  const result=Array.isArray(data?.[0])?data[0].map(part=>part?.[0]||'').join(''):'';
  if(!result)throw new Error('Google Translate Free returned no translation. The endpoint may have rejected this chapter. No chunks were sent.');return result;
 }
 if(source.type==='google'&&count>30000)throw new Error('This chapter exceeds Google Cloud Translation’s 30,000-character request limit. No chunks were sent.');
 if(source.type==='deepl'&&count>128000)throw new Error('This chapter exceeds DeepL’s 128,000-character request limit. No chunks were sent.');
 let response,data;
 if(source.type==='google'){
  if(!source.apiKey)throw new Error('Add your Google Cloud Translation API key in Translation sources.');
  response=await fetch('https://translation.googleapis.com/language/translate/v2?key='+encodeURIComponent(source.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text,target,format:'text'})});
  data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Google Translate request failed');
  return data.data?.translations?.[0]?.translatedText?decodeEntities(data.data.translations[0].translatedText):(()=>{throw new Error('Google returned no translated text')})();
 }
 if(source.type==='deepl'){
  if(!source.apiKey)throw new Error('Add your DeepL API key in Translation sources.');
  const endpoint=source.endpoint||'https://api-free.deepl.com/v2/translate';
  response=await fetch(endpoint,{method:'POST',headers:{'Authorization':'DeepL-Auth-Key '+source.apiKey,'Content-Type':'application/json'},body:JSON.stringify({text:[text],target_lang:target.toUpperCase()})});
  data=await response.json();if(!response.ok)throw new Error(data.message||data.detail||'DeepL request failed');
  if(!data.translations?.[0]?.text)throw new Error('DeepL returned no translated text');return data.translations[0].text;
 }
 const endpoint=(source.endpoint||'').replace(/\/$/,'');
 if(!endpoint)throw new Error('Set the LibreTranslate server endpoint.');
 response=await fetch(endpoint+'/translate',{method:'POST',headers:{'Content-Type':'application/json',...(source.apiKey?{'Authorization':'Bearer '+source.apiKey}:{})},body:JSON.stringify({q:text,source:'auto',target,format:'text',...(source.apiKey?{api_key:source.apiKey}:{})})});
 data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'LibreTranslate request failed');
 if(!data.translatedText)throw new Error('Translation server returned no translated text');return data.translatedText;
}
function decodeEntities(value){const el=document.createElement('textarea');el.innerHTML=value;return el.value}
export function openTranslatePage(){
 if(!state.book?.chapters?.[state.chapter])return toast('No chapter is open');
 const list=sources();
 if(!list.length){manageTranslationSources();toast('Create a translation source first');return}
 const options=list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc(sourceTypeLabel(s.type))+'</option>').join('');
 const body='<div class="stack"><label>Translation source<select id="trChooseSource">'+options+'</select></label><label>Target language code<input id="trTargetLanguage" value="'+esc(list[0].defaultTarget||'en')+'" placeholder="en, zh-CN, ja…"></label><p id="trProviderNote" class="muted tiny">The complete chapter is sent in one request to preserve context. It will not be split into smaller chunks. Image markers are protected and restored after translation.</p><div id="trProgress" class="muted tiny" aria-live="polite"></div><div id="trOmniReturn" class="stack hidden"><label>Paste the translated chapter<textarea id="trOmniText" rows="8" placeholder="Paste the full translation from OmniTranslate…"></textarea></label><button id="trOmniApply" class="primary">Apply pasted translation</button></div><div class="row"><button id="trManageSources">Manage sources</button><span class="grow"></span><button id="trStart" class="primary">Translate entire chapter</button></div></div>';
 modal('Translate page',body,()=>{
  const updateProvider=()=>{const s=sources().find(x=>x.id===$('trChooseSource').value);if(s){$('trTargetLanguage').value=s.defaultTarget||'en';$('trProviderNote').textContent=s.type==='googleFree'?'Free unofficial Google Translate endpoint. One complete-chapter request; very long chapters may be rejected by the public endpoint. No API key, quota or uptime guarantee.':s.type==='omni'?'OmniTranslate has no documented public translation API. This option copies the whole chapter and opens OmniTranslate for manual translation; paste the result back here.': 'The complete chapter is sent in one request. It will not be split into smaller chunks.';$('trStart').textContent=s.type==='omni'?'Copy chapter & open OmniTranslate':'Translate entire chapter'}};
  $('trChooseSource').onchange=updateProvider;updateProvider();
  $('trManageSources').onclick=()=>manageTranslationSources();
  $('trStart').onclick=async()=>{
   const source=sources().find(s=>s.id===$('trChooseSource').value),target=$('trTargetLanguage').value.trim();
   const original=state.book.chapters[state.chapter]?.text;
   if(source?.type==='omni'){const tab=window.open('https://app.readomni.com/','_blank');try{await navigator.clipboard.writeText(original);$('trProgress').textContent='Chapter copied. Paste it into OmniTranslate, translate it, then copy the result back here.'}catch(error){$('trProgress').textContent='Clipboard access failed. Copy the chapter manually from your novel, then paste it into OmniTranslate.'}if(tab)tab.opener=null;$('trOmniReturn').classList.remove('hidden');$('trStart').classList.add('hidden');$('trOmniApply').onclick=()=>{const result=$('trOmniText').value.trim();if(!result)return toast('Paste the translated chapter first');translated={bookId:state.book.id,chapter:state.chapter,originalText:original,text:result};translationMarkup(result);updateControls();closeModal();toast('OmniTranslate result applied')};return;}
   if(!source||!target||!original)return toast('Choose a source and target language');
   $('trStart').disabled=true;$('trProgress').textContent='Translating the complete chapter…';
   try{
    const protectedTokens=[];
    const safeText=original.replace(/\[IMAGE:[^\]]+\]/g,token=>{const marker='QRIMAGEPLACEHOLDER'+protectedTokens.length+'TOKEN';protectedTokens.push([marker,token]);return marker});
    let result=await translateWith(source,safeText,target);
    for(const [marker,token] of protectedTokens)result=result.replaceAll(marker,token);
    translated={bookId:state.book.id,chapter:state.chapter,originalText:original,text:result};
    translationMarkup(result);updateControls();closeModal();toast('Chapter translated');
   }catch(error){$('trProgress').textContent=error.message;$('trStart').disabled=false}
  };
 });
}
export async function translateImageText(text,sourceId){const source=sources().find(item=>item.id===sourceId);if(!source)throw new Error('Choose a translation source first.');if(source.type==='omni')throw new Error('OmniTranslate manual handoff is not supported for image overlays. Choose an API source.');return translateWith(source,text,'en')}
export function getImageTranslationSources(){return sources().filter(source=>source.type!=='omni').map(({id,name,type})=>({id,name,type}))}
export function syncTranslationControls(){updateControls()}
