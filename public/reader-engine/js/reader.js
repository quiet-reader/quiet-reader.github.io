import {state} from './state.js';import {put} from './db.js';import {$,esc,toast,paragraphs} from './utils.js';import {setScreen} from './state.js';import {renderHighlights} from './highlights.js';
import {loadKokoro,generateKokoro,playKokoroAudio,pauseKokoro,resumeKokoro,stopKokoro,DEFAULT_KOKORO_VOICE} from './kokoro.js';
export function chapterHTML(ch){
 const images=new Map((ch.images||[]).map(im=>[im.id,im]));
 return paragraphs(ch.text).map((paragraph,paragraphIndex)=>{
  const parts=paragraph.split(/(\[IMAGE:[^\]]+\])/g).map(part=>{
   const match=part.match(/^\[IMAGE:([^\]]+)\]$/);
   if(match){const im=images.get(match[1]);return im?'<figure><img src="'+im.data+'" alt=""><figcaption class="tiny muted">'+esc(im.caption||'')+'</figcaption></figure>':''}
   return esc(part);
  }).join('');
  return /^\[IMAGE:[^\]]+\]$/.test(paragraph)?parts:'<p data-paragraph-index="'+paragraphIndex+'">'+parts+'</p>';
 }).join('');
}
export function openReader(index){stopAutoRead(false);novelSearchBookId=null;const b=state.book;if(!b?.chapters?.length){toast('Add a chapter first');return}state.chapter=Math.max(0,Math.min(index,b.chapters.length-1));drawReader();setScreen('reader');const saved=b.progress?.chapter===state.chapter?b.progress.offset:0;window.scrollTo(0,saved||0)}
export function drawReader(){const b=state.book,c=b.chapters[state.chapter];if(!c)return;$('readerBookTitle').textContent=b.title;$('chapterKicker').textContent='Chapter '+(state.chapter+1)+' of '+b.chapters.length;$('readingTitle').textContent=c.title||'Chapter '+(state.chapter+1);$('readingBody').innerHTML=chapterHTML(c);renderChapterFormat(chapterFormat);$('jumpChapter').innerHTML=b.chapters.map((x,i)=>'<option value="'+i+'">'+esc(x.title||'Chapter '+(i+1))+'</option>').join('');$('jumpChapter').value=state.chapter;$('prevChapter').disabled=state.chapter===0;$('nextChapter').disabled=state.chapter===b.chapters.length-1;$('chapterCounter').textContent=(state.chapter+1)+' / '+b.chapters.length;updateBookmarkButton();renderHighlights()}
export async function saveProgress(){if(!state.book)return;state.book.progress={chapter:state.chapter,offset:window.scrollY};state.book.updated=Date.now();await put(state.book)}
export async function changeChapter(delta){stopAutoRead();await saveProgress();const next=state.chapter+delta;if(next<0||next>=state.book.chapters.length)return;state.chapter=next;drawReader();window.scrollTo(0,0)}
export async function jumpChapter(index){stopAutoRead();await saveProgress();state.chapter=Number(index);drawReader();window.scrollTo(0,0)}
let novelSearchBookId=null;
let novelSearchIndex=[];
let novelSearchMatches=[];
let novelSearchQuery='';
let novelSearchShown=80;
function buildNovelSearchIndex(){
 novelSearchBookId=state.book?.id||null;
 novelSearchIndex=(state.book?.chapters||[]).map((chapter,chapterIndex)=>({
  chapterIndex,
  title:String(chapter.title||'Chapter '+(chapterIndex+1)),
  titleLower:String(chapter.title||'Chapter '+(chapterIndex+1)).toLocaleLowerCase(),
  paragraphs:paragraphs(chapter.text).map((text,paragraphIndex)=>({text,lower:text.toLocaleLowerCase(),paragraphIndex}))
 }));
}
function searchSnippet(text,offset,length){
 const start=Math.max(0,offset-58),end=Math.min(text.length,offset+length+82);
 return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'');
}
function renderNovelSearchResults(){
 const results=$('novelSearchResults');
 if(!results)return;
 if(!novelSearchMatches.length){results.innerHTML='<p class="tiny muted">No matches found.</p>';return}
 const shown=novelSearchMatches.slice(0,novelSearchShown);
 results.innerHTML='<p class="tiny muted">'+novelSearchMatches.length.toLocaleString()+' match'+(novelSearchMatches.length===1?'':'es')+(novelSearchMatches.length>shown.length?' · showing '+shown.length:'')+'</p>'+shown.map((m,i)=>'<button type="button" class="novel-search-result" data-search-result="'+i+'"><b>Chapter '+(m.chapterIndex+1)+' · '+esc(novelSearchIndex[m.chapterIndex].title)+'</b><span>'+esc(m.titleMatch?'Chapter title: '+m.snippet:m.snippet)+'</span></button>').join('')+(shown.length<novelSearchMatches.length?'<button type="button" class="novel-search-more" data-search-more>Show more results</button>':'');
 results.querySelectorAll('[data-search-result]').forEach((button,i)=>{
  const match=novelSearchMatches[i];
  button.dataset.searchChapter=match.chapterIndex;
  button.dataset.searchParagraph=match.paragraphIndex;
  button.dataset.searchOffset=match.offset;
  button.dataset.searchTitle=match.titleMatch?'1':'0';
 });
}
export function showMoreNovelSearchResults(){novelSearchShown+=80;renderNovelSearchResults()}
export function searchNovel(query){
 const input=$('novelSearch'),results=$('novelSearchResults');
 if(!input||!results)return;
 const term=String(query??input.value).trim();
 if(!term){novelSearchMatches=[];novelSearchQuery='';results.innerHTML='<p class="tiny muted">Search across every chapter in this novel.</p>';return}
 if(novelSearchBookId!==state.book?.id)buildNovelSearchIndex();
 const needle=term.toLocaleLowerCase();
 novelSearchMatches=[];novelSearchQuery=term;novelSearchShown=80;
 for(const chapter of novelSearchIndex){
  let titleAt=chapter.titleLower.indexOf(needle);
  if(titleAt!==-1)novelSearchMatches.push({chapterIndex:chapter.chapterIndex,paragraphIndex:-1,offset:titleAt,titleMatch:true,snippet:chapter.title});
  for(const paragraph of chapter.paragraphs){
   let at=0;
   while((at=paragraph.lower.indexOf(needle,at))!==-1){
    novelSearchMatches.push({chapterIndex:chapter.chapterIndex,paragraphIndex:paragraph.paragraphIndex,offset:at,titleMatch:false,snippet:searchSnippet(paragraph.text,at,term.length)});
    at+=Math.max(1,needle.length);
   }
  }
 }
 renderNovelSearchResults();
}
function textPointAt(root,offset){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node,remaining=offset;
 while((node=walker.nextNode())){
  if(remaining<=node.nodeValue.length)return{node,offset:remaining};
  remaining-=node.nodeValue.length;
 }
 return null;
}
function highlightSearchMatch(paragraph,offset,term){
 if(!paragraph||!term)return false;
 const point=textPointAt(paragraph,offset),end=textPointAt(paragraph,offset+term.length);
 if(!point||!end)return false;
 const range=document.createRange();
 range.setStart(point.node,point.offset);range.setEnd(end.node,end.offset);
 const mark=document.createElement('span');mark.className='search-match';
 try{mark.append(range.extractContents());range.insertNode(mark);mark.scrollIntoView({behavior:'smooth',block:'center'});return true}
 catch{return false}
}
export async function openNovelSearchResult(chapterIndex,paragraphIndex,offset,query,titleMatch=false){
 await jumpChapter(chapterIndex);
 if(titleMatch){$('readingTitle').scrollIntoView({behavior:'smooth',block:'center'});return}
 const paragraph=$('readingBody').querySelector('[data-paragraph-index="'+Number(paragraphIndex)+'"]');
 if(!highlightSearchMatch(paragraph,Number(offset),String(query||'')))toast('Could not locate that exact match in the chapter');
}

function updateBookmarkButton(){const button=$('bookmarkBtn');if(!button)return;const saved=(state.book?.bookmarks||[]).some(mark=>mark.chapter===state.chapter);button.classList.toggle('is-bookmarked',saved);button.textContent=saved?'★':'☆';button.setAttribute('aria-pressed',String(saved));button.title=saved?'Remove bookmark from this chapter':'Bookmark this chapter';button.setAttribute('aria-label',button.title)}
export async function addBookmark(){const b=state.book;if(!b)return;b.bookmarks=b.bookmarks||[];const existing=b.bookmarks.some(mark=>mark.chapter===state.chapter);if(existing){b.bookmarks=b.bookmarks.filter(mark=>mark.chapter!==state.chapter);toast('Bookmark removed')}else{const anchorOffset=window.scrollY+window.innerHeight/2;b.bookmarks.push({id:crypto.randomUUID?.()||String(Date.now()),chapter:state.chapter,offset:window.scrollY,anchorOffset,text:$('readingTitle').textContent,created:Date.now()});toast('Bookmark saved')}await put(b);updateBookmarkButton()}
let chapterFormat='normal';
let sectionParts=[];
function isEnglish(text){
 const words=String(text||'').toLowerCase().match(/[a-z]+/g)||[];
 if(words.length<5)return false;
 const common=new Set(['the','and','that','this','with','from','have','was','were','you','your','his','her','they','them','their','for','but','not','are','had','has','will','would','could','should','what','when','where','who','how','why','said','she','him','into','then','there','about','one','all','can','been','being','because','which','while','after','before','over','under','out','our','we','he','it','of','to','in','on','as','at','by','is','be','or','an','a']);
 const hits=words.filter(w=>common.has(w)).length;
 return hits>=3&&hits/words.length>=0.035;
}
function splitIntoSections(text,limit=5000){
 const paragraphsList=paragraphs(text);
 const chunks=[];let current='';
 const pushPiece=piece=>{if(!piece)return;if(!current)current=piece;else if(current.length+2+piece.length<=limit)current+='\n\n'+piece;else{chunks.push(current);current=piece}};
 for(const paragraph of paragraphsList){
  let remaining=paragraph;
  while(remaining.length>limit){
   let cut=remaining.lastIndexOf(' ',limit);
   if(cut<1)cut=limit;
   pushPiece(remaining.slice(0,cut).trim());
   remaining=remaining.slice(cut).trim();
   if(current){chunks.push(current);current=''}
  }
  pushPiece(remaining);
 }
 if(current)chunks.push(current);
 return chunks;
}

export function renderChapterFormat(mode=chapterFormat){
 chapterFormat=mode;
 const controls=$('chapterFormatControls'),view=$('sectionView');
 if(!controls||!view)return;
 const chapter=state.book?.chapters?.[state.chapter];
 const hasText=Boolean(chapter?.text?.trim());
 controls.classList.toggle('hidden',!hasText);
 view.classList.add('hidden');view.innerHTML='';
 $('readingBody')?.classList.toggle('hidden',chapterFormat==='sections'&&hasText);
 controls.querySelectorAll('[data-chapter-format]').forEach(b=>b.classList.toggle('active',b.dataset.chapterFormat===chapterFormat));
 if(!hasText){chapterFormat='normal';return}
 if(chapterFormat!=='sections')return;
 sectionParts=splitIntoSections(chapter.text,5000);
 view.innerHTML=sectionParts.map((part,i)=>'<section class="reading-section"><div class="section-heading-row"><b>Section '+(i+1)+' <span class="muted tiny">· '+part.length.toLocaleString()+' characters</span></b><div class="row"><button type="button" data-copy-section="'+i+'">Copy section</button><button type="button" data-toggle-section="'+i+'">Expand</button></div></div><div class="section-content hidden"><p>'+esc(part).replace(/\n/g,'<br>')+'</p></div></section>').join('');
 view.classList.remove('hidden');
}
export async function copyChapter(){const text=state.book?.chapters?.[state.chapter]?.text;if(text==null)return toast('Chapter not found');try{await navigator.clipboard.writeText(text);toast('Entire chapter copied')}catch{const ta=document.createElement('textarea');ta.value=text;document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();toast(ok?'Entire chapter copied':'Could not copy chapter')}}
export async function copySection(index){
 const text=sectionParts[Number(index)];
 if(text==null)return toast('Section not found');
 try{await navigator.clipboard.writeText(text);toast('Section copied')}
 catch{const ta=document.createElement('textarea');ta.value=text;document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();toast(ok?'Section copied':'Could not copy section')}
}
export function toggleSection(index,button){
 const content=$('sectionView')?.querySelectorAll('.section-content')[Number(index)];
 if(!content)return;
 content.classList.toggle('hidden');
 button.textContent=content.classList.contains('hidden')?'Expand':'Collapse';
}



let autoReadTimer=null;
let autoReadIndex=0;
let autoReadRunning=false;
let autoReadPaused=false;
let currentUtterance=null;
let availableVoices=[];
let voicesReady=false;
let kokoroVoice='af_heart';
const KOKORO_BUFFER_SIZE=10;
let kokoroQueue=new Map();
let kokoroQueueEpoch=0;
let kokoroQueueWorker=false;
let kokoroSentenceUnits=[];
let kokoroSentenceIndex=0;
let autoReadCharOffset=0;
let autoReadCursorChapter=-1;
function cursorKey(){return 'qrAutoReadCursor:'+String(state.book?.id||'')}
function saveAutoReadCursor(){if(!state.book)return;const cursor={chapter:state.chapter,paragraph:autoReadIndex,char:autoReadCharOffset};try{localStorage.setItem(cursorKey(),JSON.stringify(cursor))}catch{}}
function loadAutoReadCursor(){try{const value=JSON.parse(localStorage.getItem(cursorKey())||'null');if(value&&value.chapter===state.chapter){autoReadIndex=Math.max(0,Number(value.paragraph)||0);autoReadCharOffset=Math.max(0,Number(value.char)||0)}else{autoReadIndex=0;autoReadCharOffset=0}}catch{autoReadIndex=0;autoReadCharOffset=0}}
export function setAutoReadPosition(paragraphIndex){if(!state.book)return false;const wasRunning=autoReadRunning;const nodes=autoReadNodes();autoReadIndex=Math.max(0,Math.min(nodes.length-1,Number(paragraphIndex)||0));autoReadCharOffset=0;kokoroSentenceIndex=0;kokoroSentenceUnits=[];saveAutoReadCursor();if(autoReadRunning){cancelSpeech();autoReadRunning=true;autoReadPaused=false;if($('ttsEnabled')?.checked&&$('ttsEngine')?.value==='kokoro')rebuildKokoroSentenceUnits();scheduleAutoRead()}else{highlightAutoReadParagraph();toast('Auto-read will start from this paragraph')}return wasRunning}
function splitSpeechSentences(text){
 const source=String(text||'').trim();
 if(!source)return [];
 if(typeof Intl!=='undefined'&&Intl.Segmenter){
  const segmenter=new Intl.Segmenter(undefined,{granularity:'sentence'});
  const parts=[...segmenter.segment(source)].map(x=>x.segment.trim()).filter(Boolean);
  if(parts.length)return parts;
 }
 return source.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g)?.map(x=>x.trim()).filter(Boolean)||[source];
}
function rebuildKokoroSentenceUnits(){
 kokoroSentenceUnits=[];
 autoReadNodes().forEach((node,nodeIndex)=>{
  const source=node.innerText||'';let cursor=0;
  splitSpeechSentences(source).forEach(text=>{let at=source.indexOf(text,cursor);if(at<0)at=cursor;kokoroSentenceUnits.push({text,nodeIndex,charStart:at});cursor=at+text.length});
 });
 kokoroSentenceIndex=kokoroSentenceUnits.findIndex(unit=>unit.nodeIndex>autoReadIndex||(unit.nodeIndex===autoReadIndex&&unit.charStart+unit.text.length>autoReadCharOffset));
 if(kokoroSentenceIndex<0)kokoroSentenceIndex=kokoroSentenceUnits.length;
 const unit=kokoroSentenceUnits[kokoroSentenceIndex];
 if(unit){autoReadIndex=unit.nodeIndex;const skip=Math.max(0,autoReadCharOffset-unit.charStart);if(skip>0){unit.text=unit.text.slice(skip);unit.charStart+=skip}autoReadCharOffset=unit.charStart}
}
function clearKokoroQueue(){kokoroQueueEpoch++;kokoroQueue.clear();kokoroQueueWorker=false;stopKokoro()}
function fillKokoroQueue(){
 if(!autoReadRunning||autoReadPaused||$('ttsEngine')?.value!=='kokoro')return;
 const end=Math.min(kokoroSentenceUnits.length,kokoroSentenceIndex+KOKORO_BUFFER_SIZE);
 for(let i=kokoroSentenceIndex;i<end;i++){
  if(kokoroQueue.has(i))continue;
  let resolve,reject;
  const entry={audio:null,error:null,started:false,promise:new Promise((res,rej)=>{resolve=res;reject=rej})};
  entry.resolve=resolve;entry.reject=reject;kokoroQueue.set(i,entry);
 }
 if(kokoroQueueWorker)return;
 const epoch=kokoroQueueEpoch;kokoroQueueWorker=true;
 (async()=>{
  try{
   while(epoch===kokoroQueueEpoch&&autoReadRunning&&!autoReadPaused){
    const next=[...kokoroQueue.entries()].find(([index,entry])=>index>=kokoroSentenceIndex&&!entry.started)?.[0];
    if(next==null)break;
    const entry=kokoroQueue.get(next);entry.started=true;
    const text=kokoroSentenceUnits[next]?.text||'';
    if(!text){entry.audio=null;entry.resolve(null);continue}
    try{
     const audio=await generateKokoro(text,{voice:$('kokoroVoice')?.value||kokoroVoice,speed:ttsSpeechRate(),onStatus:message=>{if(next===kokoroSentenceIndex)setTTSStatus(message)}});
     if(epoch!==kokoroQueueEpoch)return;
     entry.audio=audio;entry.resolve(audio);
    }catch(error){if(epoch!==kokoroQueueEpoch)return;entry.error=error;entry.reject(error)}
   }
  }finally{if(epoch===kokoroQueueEpoch)kokoroQueueWorker=false}
 })();
}
function queuedKokoroAudio(index){
 let entry=kokoroQueue.get(index);
 if(!entry){fillKokoroQueue();entry=kokoroQueue.get(index)}
 return entry?.promise||Promise.resolve(entry?.audio||null);
}
function trimKokoroQueue(){for(const index of kokoroQueue.keys())if(index<kokoroSentenceIndex)kokoroQueue.delete(index)}
function autoReadNodes(){return [...$('readingBody').querySelectorAll('p')]}
function ttsSupported(){return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window}
function selectedVoice(){
 const id=$('ttsVoice')?.value;
 return availableVoices.find(v=>v.voiceURI===id)||null;
}
function setTTSStatus(message){const el=$('ttsStatus');if(el)el.textContent=message}
function loadTTSVoices(){
 if(!ttsSupported()){setTTSStatus('TTS unavailable');$('ttsVoice').innerHTML='<option value="">Not supported by this browser</option>';$('ttsEnabled').checked=false;$('ttsEnabled').disabled=true;$('ttsSpeechSpeedControl')?.classList.add('hidden');return}
 availableVoices=window.speechSynthesis.getVoices()||[];
 if(!availableVoices.length){setTTSStatus('Waiting for voices…');return}
 voicesReady=true;
 const select=$('ttsVoice'),previous=select.value;
 const sorted=[...availableVoices].sort((a,b)=>Number(b.localService)-Number(a.localService)||a.name.localeCompare(b.name));
 select.innerHTML=sorted.map(v=>'<option value="'+esc(v.voiceURI)+'">'+esc(v.name)+' · '+esc(v.lang)+(v.localService?' · Local':' · Device/network')+'</option>').join('');
 if(sorted.some(v=>v.voiceURI===previous))select.value=previous;
 else if(sorted.length){const preferred=sorted.find(v=>v.localService)||sorted[0];select.value=preferred.voiceURI}
 setTTSStatus(sorted.some(v=>v.localService)?'Local voices available':'Using available device voice');
}
function updateAutoReadControls(){
 const start=$('autoReadStart'),pause=$('autoReadPause'),stop=$('autoReadStop'),speed=$('autoReadSpeed'),value=$('autoReadSpeedValue');
 if(start){start.textContent=autoReadPaused?'▶ Resume':'▶ Auto-read';start.disabled=autoReadRunning&&!autoReadPaused}
 if(pause)pause.disabled=!autoReadRunning||autoReadPaused;
 if(stop)stop.disabled=!autoReadRunning&&!autoReadPaused;
 if(speed&&value){const rate=autoReadCharsPerMinute(Number(speed.value||0));value.textContent=rate>=1000?(rate/1000).toFixed(rate>=10000?0:1)+'k':' '+Math.round(rate);value.title=Math.round(rate).toLocaleString()+' characters/minute'}
}
function autoReadCharsPerMinute(position){
 const min=30,max=30000;
 return min*Math.pow(max/min,Math.max(0,Math.min(100,position))/100);
}
function ttsSpeechRate(){return Number($('ttsSpeechSpeed')?.value||1)}
function cancelSpeech(){
 clearKokoroQueue();
 if(ttsSupported())window.speechSynthesis.cancel();
 stopKokoro();
 currentUtterance=null;
}
function clearAutoReadSentence(){ $('readingBody')?.querySelectorAll('.auto-read-sentence').forEach(node=>{const parent=node.parentNode;if(!parent)return;while(node.firstChild)parent.insertBefore(node.firstChild,node);parent.removeChild(node);parent.normalize()}) }
function highlightAutoReadSentence(text){
 clearAutoReadSentence();const node=autoReadNodes()[autoReadIndex];if(!node||!text)return;
 const source=node.textContent||'';let at=source.indexOf(text);if(at<0){const normalized=text.trim();at=source.indexOf(normalized);if(at<0)return;text=normalized;}
 const point=(offset)=>{const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let current,remaining=offset;while((current=walker.nextNode())){if(remaining<=current.nodeValue.length)return{node:current,offset:remaining};remaining-=current.nodeValue.length}return null};
 const start=point(at),end=point(at+text.length);if(!start||!end)return;
 const range=document.createRange();range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset);const span=document.createElement('span');span.className='auto-read-sentence';try{span.append(range.extractContents());range.insertNode(span)}catch{}
}
function highlightAutoReadParagraph(){
 const nodes=autoReadNodes();
 nodes.forEach((node,i)=>node.classList.toggle('focus-current',i===autoReadIndex));
 $('readingBody').classList.add('focus-active');
 const current=nodes[autoReadIndex];
 if(current){
  const top=current.getBoundingClientRect().top+window.scrollY-window.innerHeight*0.34;
  const speed=Number($('autoReadSpeed')?.value||55);
  window.scrollTo({top:Math.max(0,top),behavior:speed>78?'auto':'smooth'});
 }
}
function speakCurrentParagraph(){
 if(!$('ttsEnabled')?.checked)return false;
 if($('ttsEngine')?.value==='kokoro'){
  speakCurrentKokoroSentence();
  return true;
 }
 if(!ttsSupported()||!voicesReady)return false;
 const nodes=autoReadNodes(),node=nodes[autoReadIndex];
 const fullText=(node?.innerText||'').trim();const startingOffset=Math.max(0,Math.min(fullText.length,autoReadCharOffset));const text=fullText.slice(startingOffset);
 if(!text)return false;
 cancelSpeech();
 const utterance=new SpeechSynthesisUtterance(text);
 const voice=selectedVoice();
 if(voice)utterance.voice=voice;
 utterance.rate=ttsSpeechRate();
 utterance.onstart=()=>setTTSStatus('Speaking'+(voice?.localService?' · Local':''));
 utterance.onboundary=event=>{if(currentUtterance!==utterance||!Number.isFinite(event.charIndex))return;currentUtterance.charIndex=startingOffset+event.charIndex;autoReadCharOffset=startingOffset+event.charIndex;saveAutoReadCursor();const source=utterance.text||'';let start=0,end=source.length;const before=source.slice(0,event.charIndex);const last=Math.max(before.lastIndexOf('.'),before.lastIndexOf('!'),before.lastIndexOf('?'),before.lastIndexOf('。'),before.lastIndexOf('！'),before.lastIndexOf('？'));if(last>=0)start=last+1;const tail=source.slice(event.charIndex);const stops=[tail.indexOf('.'),tail.indexOf('!'),tail.indexOf('?'),tail.indexOf('。'),tail.indexOf('！'),tail.indexOf('？')].filter(x=>x>=0);if(stops.length)end=event.charIndex+Math.min(...stops)+1;highlightAutoReadSentence(source.slice(start,end).trim())};
 utterance.onend=()=>{if(currentUtterance!==utterance)return;currentUtterance=null;if(autoReadRunning&&!autoReadPaused)advanceAutoRead()};
 utterance.onerror=event=>{if(currentUtterance!==utterance)return;currentUtterance=null;setTTSStatus('Speech error · continuing focus mode');if(autoReadRunning&&!autoReadPaused){const chars=(node.innerText||'').length;const delay=Math.max(800,Math.min(60000,chars/autoReadCharsPerMinute(Number($('autoReadSpeed')?.value||55))*60000));autoReadTimer=setTimeout(advanceAutoRead,delay)}};
 currentUtterance=utterance;
 window.speechSynthesis.speak(utterance);
 return true;
}
function speakCurrentKokoroSentence(){
 if(!autoReadRunning||autoReadPaused)return;
 const unit=kokoroSentenceUnits[kokoroSentenceIndex];
 if(!unit){finishKokoroChapter();return}
 autoReadIndex=unit.nodeIndex;autoReadCharOffset=unit.charStart;
 highlightAutoReadParagraph();highlightAutoReadSentence(unit.text);
 const marker={kokoro:true,playing:false,sentenceIndex:kokoroSentenceIndex};
 currentUtterance=marker;
 fillKokoroQueue();
 queuedKokoroAudio(kokoroSentenceIndex).then(audio=>{
  if(currentUtterance!==marker||!autoReadRunning||autoReadPaused)return;
  if(!audio)throw new Error('No buffered audio for this sentence');
  marker.playing=true;
  playKokoroAudio(audio,{onStatus:setTTSStatus,onProgress:seconds=>{if(currentUtterance!==marker)return;const ratio=Math.max(0,Math.min(0.999,seconds/Math.max(0.01,audio.audioSeconds||audio.samples.length/(audio.sampleRate||24000))));autoReadCharOffset=unit.charStart+Math.floor(unit.text.length*ratio);saveAutoReadCursor()}}).then(()=>{
   if(currentUtterance!==marker)return;
   currentUtterance=null;
   if(autoReadRunning&&!autoReadPaused){
    kokoroSentenceIndex++;
    trimKokoroQueue();
    fillKokoroQueue();
    const next=kokoroSentenceUnits[kokoroSentenceIndex];
    if(next){autoReadIndex=next.nodeIndex;speakCurrentKokoroSentence()}
    else finishKokoroChapter();
   }
  }).catch(error=>{
   if(currentUtterance!==marker)return;
   currentUtterance=null;
   setTTSStatus('Kokoro playback error · '+(error?.message||'unknown error'));
   if(autoReadRunning&&!autoReadPaused)autoReadTimer=setTimeout(()=>speakCurrentKokoroSentence(),1000);
  });
 }).catch(error=>{
  if(currentUtterance!==marker)return;
  currentUtterance=null;
  setTTSStatus('Kokoro error · '+(error?.message||'unknown error'));
  if(autoReadRunning&&!autoReadPaused)autoReadTimer=setTimeout(()=>speakCurrentKokoroSentence(),1000);
 });
}
async function finishKokoroChapter(){
 if(!autoReadRunning||autoReadPaused)return;
 if(state.chapter<state.book.chapters.length-1){
  await saveProgress();
  if(!autoReadRunning||autoReadPaused)return;
  state.chapter++;
  drawReader();
  window.scrollTo({top:0,behavior:'auto'});
  rebuildKokoroSentenceUnits();
  clearKokoroQueue();
  fillKokoroQueue();
  speakCurrentKokoroSentence();
 }else{
  stopAutoRead();
  toast('Reached the end of the novel');
 }
}
function scheduleAutoRead(){
 clearTimeout(autoReadTimer);
 if(!autoReadRunning||autoReadPaused)return;
 const nodes=autoReadNodes();
 if(!nodes.length||autoReadIndex>=nodes.length){advanceAutoRead();return}
 if($('ttsEnabled')?.checked&&$('ttsEngine')?.value==='kokoro'){speakCurrentKokoroSentence();return}
 highlightAutoReadParagraph();
 if(speakCurrentParagraph())return;
 setTTSStatus($('ttsEnabled')?.checked?'TTS voice not ready · focus mode active':'Focus mode active · TTS off');
 const speed=Number($('autoReadSpeed')?.value||55);
 const chars=(nodes[autoReadIndex].innerText||'').length;
 const charsPerMinute=autoReadCharsPerMinute(speed);
 const delay=Math.max(80,Math.min(60000,chars/charsPerMinute*60000));
 autoReadTimer=setTimeout(advanceAutoRead,delay);
}
async function advanceAutoRead(){
 if(!autoReadRunning||autoReadPaused)return;
 clearTimeout(autoReadTimer);autoReadTimer=null;currentUtterance=null;
 autoReadIndex++;autoReadCharOffset=0;saveAutoReadCursor();trimKokoroQueue();fillKokoroQueue();
 const nodes=autoReadNodes();
 if(autoReadIndex>=nodes.length){
  if(state.chapter<state.book.chapters.length-1){
   await saveProgress();
   state.chapter++;
   autoReadIndex=0;autoReadCharOffset=0;kokoroSentenceIndex=0;
   drawReader();
   window.scrollTo({top:0,behavior:'auto'});
  }else{
   stopAutoRead();
   toast('Reached the end of the novel');
   return;
  }
 }
 scheduleAutoRead();
}
export async function startAutoRead(){
 if(!state.book?.chapters?.length)return;
 if($('ttsEnabled')?.checked&&$('ttsEngine')?.value==='kokoro'){
  try{await loadKokoro(message=>setTTSStatus(message));populateKokoroVoices();}
  catch(error){setTTSStatus('Kokoro load failed · '+(error?.message||'check connection'));toast('Could not load Kokoro. Check your connection and try again.');return}
 }
 if(!autoReadRunning){loadAutoReadCursor();autoReadRunning=true;autoReadPaused=false;if($('ttsEnabled')?.checked&&$('ttsEngine')?.value==='kokoro')rebuildKokoroSentenceUnits();else if(!autoReadNodes().length)autoReadIndex=0}
 else if(autoReadPaused){autoReadPaused=false;if(currentUtterance?.kokoro&&currentUtterance.playing){resumeKokoro();fillKokoroQueue();updateAutoReadControls();return} if($('ttsEngine')?.value==='kokoro'&&kokoroSentenceUnits.length===0)rebuildKokoroSentenceUnits();if(currentUtterance?.kokoro)currentUtterance=null;if(ttsSupported()&&currentUtterance){window.speechSynthesis.resume();updateAutoReadControls();return}}
 updateAutoReadControls();
 scheduleAutoRead();
}
export function isAutoReadSpeaking(){if(!autoReadRunning||autoReadPaused||!$('ttsEnabled')?.checked||!currentUtterance)return false;return currentUtterance.kokoro?Boolean(currentUtterance.playing):Boolean(ttsSupported()&&window.speechSynthesis.speaking)}
export function pauseAutoRead(){
 if(!autoReadRunning)return;
 autoReadPaused=true;
 $('readingBody')?.querySelectorAll('.read-from-here-hover').forEach(node=>node.classList.remove('read-from-here-hover'));
 clearTimeout(autoReadTimer);
 if(ttsSupported())window.speechSynthesis.pause();
 pauseKokoro();
 updateAutoReadControls();
 setTTSStatus('Paused');
}
export function stopAutoRead(showToast=true){
 if(autoReadRunning&&currentUtterance&&!currentUtterance.kokoro&&Number.isFinite(currentUtterance.charIndex))autoReadCharOffset=currentUtterance.charIndex;
 saveAutoReadCursor();
 clearTimeout(autoReadTimer);
 autoReadTimer=null;
 cancelSpeech();
 autoReadRunning=false;
 autoReadPaused=false;
 kokoroSentenceIndex=0;kokoroSentenceUnits=[];
 $('readingBody')?.classList.remove('focus-active');clearAutoReadSentence();
 $('readingBody')?.querySelectorAll('.focus-current').forEach(node=>node.classList.remove('focus-current'));
 updateAutoReadControls();
 setTTSStatus('Ready');
 if(showToast)toast('Auto-read stopped');
}
export function setAutoReadSpeed(){updateAutoReadControls()}
export function setTTSSpeechSpeed(){
 if(autoReadRunning&&!autoReadPaused){cancelSpeech();scheduleAutoRead()}
}
export function setTTSEnabled(){
 const enabled=$('ttsEnabled')?.checked;
 $('ttsSpeechSpeedControl')?.classList.toggle('hidden',!enabled);
 if(!enabled){cancelSpeech();$('readingBody')?.querySelectorAll('.read-from-here-hover').forEach(node=>node.classList.remove('read-from-here-hover'));setTTSStatus('TTS off · focus mode remains available')}
 else{loadTTSVoices();setTTSStatus('TTS enabled');}
 if(autoReadRunning&&!autoReadPaused){cancelSpeech();scheduleAutoRead()}
}
export function setTTSVoice(){
 if(autoReadRunning&&!autoReadPaused){cancelSpeech();scheduleAutoRead()}
 else setTTSStatus('Voice selected');
}
function populateKokoroVoices(){
 const select=$('kokoroVoice');if(!select)return;
 const voices=['af_heart','af_bella','af_nova','af_sarah','af_sky','af_nicole','af_kore','af_alloy','am_adam','am_michael','am_fenrir','am_puck','bf_emma','bf_isabella','bf_alice','bm_george','bm_fable','bm_daniel'];
 const previous=select.value||kokoroVoice;
 select.innerHTML=voices.map(v=>'<option value="'+v+'">'+v.replaceAll('_',' ')+'</option>').join('');
 select.value=voices.includes(previous)?previous:DEFAULT_KOKORO_VOICE;
}
export function setTTSEngine(){
 const kokoro=$('ttsEngine')?.value==='kokoro';
 $('ttsVoice')?.classList.toggle('hidden',kokoro);
 $('kokoroVoice')?.classList.toggle('hidden',!kokoro);
 setTTSStatus(kokoro?'Kokoro · loads on first Auto-read':'System voice selected');
 if(autoReadRunning&&!autoReadPaused){
  cancelSpeech();
  if(kokoro)rebuildKokoroSentenceUnits();
  scheduleAutoRead();
 }
}
export function initTTS(){
 if(!ttsSupported()){loadTTSVoices();return}
 loadTTSVoices();
 window.speechSynthesis.addEventListener?.('voiceschanged',loadTTSVoices);
 window.speechSynthesis.onvoiceschanged=loadTTSVoices;
}
