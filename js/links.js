import {state} from './state.js';
import {put} from './db.js';
import {$,esc,toast,modal} from './utils.js';
import {openReader} from './reader.js';

const books=()=>state.books||[];
const title=b=>b?.title||'Untitled novel';
const chapterTitle=(b,i)=>b?.chapters?.[i]?.title||'Chapter '+(i+1);
const save=async b=>{b.updated=Date.now();await put(b)};
async function syncCorrespondingChapters(a,b){
 const count=Math.min(a.chapters?.length||0,b.chapters?.length||0);
 for(const chapter of a.chapters||[])chapter.links=(chapter.links||[]).filter(x=>!(x.autoNovelPair&&x.targetBookId===b.id));
 for(const chapter of b.chapters||[])chapter.links=(chapter.links||[]).filter(x=>!(x.autoNovelPair&&x.targetBookId===a.id));
 for(let i=0;i<count;i++){
  a.chapters[i].links=a.chapters[i].links||[];b.chapters[i].links=b.chapters[i].links||[];
  a.chapters[i].links.push({targetBookId:b.id,targetChapterIndex:i,type:'counterpart',autoNovelPair:true});
  b.chapters[i].links.push({targetBookId:a.id,targetChapterIndex:i,type:'counterpart',autoNovelPair:true});
 }
 await save(a);await save(b);
 return count;
}
const relationLabel=r=>r==='counterpart'?'Alternate / corresponding edition':r==='sequel'?'Sequel':r==='prequel'?'Prequel':r==='next'?'Next chapter':'Previous chapter';
function novelPickerMarkup(prefix,label,placeholder){
 return '<div class="novel-picker stack"><label for="'+prefix+'Search">'+label+'</label><input id="'+prefix+'Search" type="search" placeholder="'+placeholder+'" autocomplete="off"><input id="'+prefix+'Value" type="hidden"><div id="'+prefix+'Results" class="novel-picker-results" aria-live="polite"></div></div>';
}
function setupNovelPicker(prefix,excludeId,onSelect){
 const input=$(prefix+'Search'),value=$(prefix+'Value'),results=$(prefix+'Results');
 if(!input||!value||!results)return;
 const render=()=>{
  const query=input.value.trim().toLocaleLowerCase();
  const matches=books().filter(book=>book.id!==excludeId&&(!query||[book.title,book.author].some(text=>String(text||'').toLocaleLowerCase().includes(query)))).sort((a,b)=>title(a).localeCompare(title(b),undefined,{sensitivity:'base'}));
  const shown=matches.slice(0,24);
  results.innerHTML=shown.map(book=>'<button type="button" class="novel-picker-result" data-novel-choice="'+esc(book.id)+'"><span><b>'+esc(title(book))+'</b><small>'+esc(book.author||'Unknown author')+' · '+(book.chapters||[]).length+' chapters</small></span><span aria-hidden="true">↗</span></button>').join('')+(matches.length>shown.length?'<p class="tiny muted novel-picker-more">Showing 24 of '+matches.length+' matches. Type more to narrow the list.</p>':'')+(!matches.length?'<p class="tiny muted novel-picker-empty">No matching novels.</p>':'');
 };
 const showSelected=book=>{
  value.value=book.id;
  input.value=title(book);
  results.innerHTML='<div class="novel-picker-selected"><span><b>'+esc(title(book))+'</b><small>'+esc(book.author||'Unknown author')+' · '+(book.chapters||[]).length+' chapters</small></span><button type="button" data-novel-choice-clear>Change</button></div>';
  if(onSelect)onSelect(book);
 };
 input.addEventListener('input',()=>{value.value='';render()});
 results.addEventListener('click',event=>{
  const clear=event.target.closest('[data-novel-choice-clear]');
  if(clear){value.value='';input.value='';render();if(onSelect)onSelect(null);input.focus();return}
  const choice=event.target.closest('[data-novel-choice]');
  if(!choice)return;
  const book=books().find(item=>item.id===choice.dataset.novelChoice);
  if(book)showSelected(book);
 });
 render();
}
export function manageNovelLinks(book=state.book){
 if(!book)return;
 if(book.locked)return toast('Unlock editing first');
 const links=Array.isArray(book.relationships)?book.relationships:[];
 const rows=links.map((link,index)=>{const target=books().find(item=>item.id===link.targetBookId);return '<div class="link-record"><span class="link-record-arrow">'+(link.type==='counterpart'?'↔':link.type==='sequel'?'→':'←')+'</span><span class="grow"><b>'+esc(target?title(target):'Missing novel')+'</b><small>'+esc(relationLabel(link.type))+'</small></span><button data-remove-novel-link="'+index+'" aria-label="Remove relationship">×</button></div>'}).join('');
 const body='<div class="stack"><p class="muted tiny">Connect this novel to another edition or to a related book in a series. Corresponding editions are linked in both directions; sequel relationships keep their direction.</p><div class="link-record-list">'+(rows||'<p class="muted tiny">No novel relationships yet.</p>')+'</div>'+novelPickerMarkup('novelLink','Search for a related novel','Type a novel title or author…')+'<label>Relationship<select id="novelLinkType"><option value="counterpart">↔ Corresponding / same novel (two-way)</option><option value="sequel">→ This novel is a prequel; selected novel is its sequel</option></select></label><div class="row"><span class="grow"></span><button id="saveNovelLink" class="primary">Add relationship</button></div></div>';
 modal('Novel relationships · '+title(book),body,()=>{
  setupNovelPicker('novelLink',book.id);
  $('saveNovelLink').onclick=async()=>{
   const targetId=$('novelLinkValue').value,type=$('novelLinkType').value;
   if(!targetId||targetId===book.id)return toast('Search for and select another novel');
   const target=books().find(item=>item.id===targetId);if(!target)return;
   book.relationships=book.relationships||[];target.relationships=target.relationships||[];
   book.relationships=book.relationships.filter(item=>item.targetBookId!==targetId);
   target.relationships=target.relationships.filter(item=>item.targetBookId!==book.id);
   book.relationships.push({targetBookId:targetId,type});
   target.relationships.push({targetBookId:book.id,type:type==='counterpart'?'counterpart':'prequel'});
   if(type==='counterpart'){const count=await syncCorrespondingChapters(book,target);toast('Novel linked; '+count+' matching chapter pair'+(count===1?'':'s')+' created')}
   else{await save(book);await save(target);toast('Novel relationship saved')}
   manageNovelLinks(book);
  };
  $('modalHost').onclick=async event=>{
   const button=event.target.closest('[data-remove-novel-link]');if(!button)return;
   const item=book.relationships?.[Number(button.dataset.removeNovelLink)];if(!item)return;
   const target=books().find(candidate=>candidate.id===item.targetBookId);
   if(target&&item.type==='counterpart'){
    for(const chapter of book.chapters||[])chapter.links=(chapter.links||[]).filter(link=>!(link.autoNovelPair&&link.targetBookId===target.id));
    for(const chapter of target.chapters||[])chapter.links=(chapter.links||[]).filter(link=>!(link.autoNovelPair&&link.targetBookId===book.id));
    await save(target);
   }
   book.relationships=book.relationships.filter(link=>link.targetBookId!==item.targetBookId);
   if(target){target.relationships=(target.relationships||[]).filter(link=>link.targetBookId!==book.id);await save(target)}
   await save(book);manageNovelLinks(book);
  };
 });
}
export function manageChapterLinks(book=state.book,index=state.chapter){
 if(book?.locked)return toast('Unlock editing first');
 const chapter=book?.chapters?.[index];if(!chapter)return;
 const existing=Array.isArray(chapter.links)?chapter.links:[];
 const rows=existing.map((link,linkIndex)=>{const target=books().find(item=>item.id===link.targetBookId);return '<div class="link-record"><span class="link-record-arrow">'+(link.type==='counterpart'?'↔':link.type==='next'?'→':'←')+'</span><span class="grow"><b>'+esc(target?title(target):'Missing novel')+'</b><small>'+esc(chapterTitle(target,Number(link.targetChapterIndex)))+' · '+esc(relationLabel(link.type))+'</small></span><button data-remove-chapter-link="'+linkIndex+'" aria-label="Remove chapter link">×</button></div>'}).join('');
 const body='<div class="stack"><p class="muted tiny">Link this chapter to its matching translation/source chapter, or to the next chapter in a serialized sequence. The linked chapter can be opened directly from the reader.</p><div class="link-record-list">'+(rows||'<p class="muted tiny">No chapter links yet.</p>')+'</div>'+novelPickerMarkup('chapterLinkBook','Search target novel','Type a novel title or author…')+'<label>Target chapter<select id="chapterLinkTarget"><option value="">Choose a novel first</option></select></label><label>Relationship<select id="chapterLinkType"><option value="counterpart">↔ Corresponding chapter (two-way)</option><option value="next">→ This chapter comes before the selected chapter</option></select></label><div class="row"><span class="grow"></span><button id="saveChapterLink" class="primary">Add chapter link</button></div></div>';
 modal('Chapter links · '+chapterTitle(book,index),body,()=>{
  const updateTargets=target=>{$('chapterLinkTarget').innerHTML=target?chapterOptions(target,0):'<option value="">Choose a novel first</option>'};
  const chapterOptions=(target,selected)=> (target?.chapters||[]).map((item,i)=>'<option value="'+i+'" '+(i===Number(selected)?'selected':'')+'>'+esc(chapterTitle(target,i))+'</option>').join('');
  setupNovelPicker('chapterLinkBook',null,updateTargets);
  $('saveChapterLink').onclick=async()=>{
   const target=books().find(item=>item.id===$('chapterLinkBookValue').value),targetIndex=Number($('chapterLinkTarget').value),type=$('chapterLinkType').value;
   if(!target||target.id===book.id&&targetIndex===index||!Number.isInteger(targetIndex)||!target.chapters[targetIndex])return toast('Search for a novel and choose a different chapter');
   chapter.links=chapter.links||[];const targetChapter=target.chapters[targetIndex];targetChapter.links=targetChapter.links||[];
   chapter.links=chapter.links.filter(link=>!(link.targetBookId===target.id&&Number(link.targetChapterIndex)===targetIndex));
   targetChapter.links=targetChapter.links.filter(link=>!(link.targetBookId===book.id&&Number(link.targetChapterIndex)===index));
   chapter.links.push({targetBookId:target.id,targetChapterIndex:targetIndex,type});
   targetChapter.links.push({targetBookId:book.id,targetChapterIndex:index,type:type==='counterpart'?'counterpart':'previous'});
   await save(book);if(target.id!==book.id)await save(target);
   toast('Chapter link saved');manageChapterLinks(book,index);
  };
  $('modalHost').onclick=async event=>{
   const button=event.target.closest('[data-remove-chapter-link]');if(!button)return;
   const item=chapter.links?.[Number(button.dataset.removeChapterLink)];if(!item)return;
   const target=books().find(candidate=>candidate.id===item.targetBookId),other=target?.chapters?.[Number(item.targetChapterIndex)];
   chapter.links=chapter.links.filter(link=>!(link.targetBookId===item.targetBookId&&Number(link.targetChapterIndex)===Number(item.targetChapterIndex)));
   if(other){other.links=(other.links||[]).filter(link=>!(link.targetBookId===book.id&&Number(link.targetChapterIndex)===index));await save(target)}
   await save(book);manageChapterLinks(book,index);
  };
 });
}
function chapterOptions(book,selected){return (book?.chapters||[]).map((chapter,index)=>'<option value="'+index+'" '+(index===Number(selected)?'selected':'')+'>'+esc(chapterTitle(book,index))+'</option>').join('')}
export function renderReaderLinks(){
 const host=$('chapterLinkNav');if(!host)return;
 const chapter=state.book?.chapters?.[state.chapter],links=chapter?.links||[];
 host.innerHTML=links.map(link=>{
  const target=books().find(item=>item.id===link.targetBookId),index=Number(link.targetChapterIndex);
  if(!target?.chapters?.[index])return '';
  const direction=link.type==='previous'?'←':link.type==='next'?'→':'↔';
  return '<button type="button" class="linked-chapter '+(link.type==='counterpart'?'counterpart':'sequence')+'" data-open-linked-book="'+esc(target.id)+'" data-open-linked-chapter="'+index+'" title="'+esc(title(target)+' · '+chapterTitle(target,index))+'"><span>'+direction+'</span><span class="linked-chapter-text">'+esc(title(target))+'<small>'+esc(chapterTitle(target,index))+'</small></span></button>';
 }).join('')+'<button type="button" class="chapter-link-manage" data-manage-current-chapter>＋ Manage links</button>';
 host.classList.toggle('hidden',false);
}
export function openLinkedChapter(bookId,index){const target=books().find(item=>item.id===bookId);if(!target)return toast('Linked novel is no longer in your library');state.book=target;openReader(Number(index))}
