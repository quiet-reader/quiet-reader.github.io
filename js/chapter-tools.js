import {state} from './state.js';
import {put} from './db.js';
import {$,esc,toast,modal,closeModal} from './utils.js';
import {drawBook,refresh} from './library.js';import {addEditEvent} from './history.js';

export function renameChapters(){
 const book=state.book;
 if(!book?.chapters?.length)return toast('There are no chapters to rename');
 if(book.locked)return toast('Unlock this novel before renaming chapters');
 const selected=new Set();
 const body='<div class="stack"><label>Find chapters<input id="renameChapterSearch" type="search" placeholder="Search chapter titles…" autocomplete="off"></label><div class="row wrap"><button type="button" id="selectAllRenameChapters">Select all chapters</button><button type="button" id="clearRenameChapterSelection">Clear selection</button><span class="muted tiny" id="renameSelectionCount"></span></div><div id="renameChapterChoices" class="rename-chapter-choices" aria-label="Chapter selection"></div><p class="muted tiny">Rename selected chapters using the order below. Use <code>{n}</code> in the replacement for serial numbering. Regex capture groups such as <code>$1</code> are supported.</p><label>Rename order<select id="renameChapterOrder"><option value="ascending">Chapter 1 → last chapter</option><option value="descending">Last chapter → Chapter 1</option></select></label><label>Find (regular expression)<input id="renamePattern" value="^.*$" spellcheck="false"></label><label>Replace with<input id="renameReplacement" value="Chapter - {n}" spellcheck="false"></label><label>Regex flags<input id="renameFlags" value="" placeholder="g, i, m, etc."></label><div class="row"><button type="button" id="previewChapterRename">Preview</button><span class="muted tiny" id="renameCount"></span></div><div id="renamePreview" class="rename-preview"></div><div class="row"><span class="grow"></span><button type="button" id="applyChapterRename" class="primary">Rename selected chapters</button></div></div>';
 modal('Rename chapters',body,()=>{
  const choices=$('renameChapterChoices');
  const orderedSelection=()=>[...selected].sort((a,b)=>a-b);
  const updateSelection=()=>{$('renameSelectionCount').textContent=selected.size+' selected';$('applyChapterRename').disabled=!selected.size};
  const renderChoices=()=>{
   const query=$('renameChapterSearch').value.trim().toLocaleLowerCase();
   const matches=book.chapters.map((chapter,index)=>({chapter,index,title:String(chapter.title||'Chapter '+(index+1))})).filter(item=>!query||item.title.toLocaleLowerCase().includes(query)||String(item.index+1).includes(query));
   choices.innerHTML=matches.length?matches.map(item=>'<label class="rename-chapter-choice"><input type="checkbox" data-rename-chapter="'+item.index+'" '+(selected.has(item.index)?'checked':'')+'><span><b>'+esc(item.title)+'</b><small>Chapter '+(item.index+1)+'</small></span></label>').join(''):'<p class="muted tiny">No chapters match this search.</p>';
   updateSelection();
  };
  const preview=()=>{
   const pattern=$('renamePattern').value,replacement=$('renameReplacement').value,flags=$('renameFlags').value;
   let regex;try{regex=new RegExp(pattern,flags)}catch(error){$('renamePreview').innerHTML='<p class="muted tiny">Invalid regular expression: '+esc(error.message)+'</p>';$('renameCount').textContent='';return null}
   const indexes=orderedSelection();if($('renameChapterOrder').value==='descending')indexes.reverse();
   let number=1;const changes=indexes.map(index=>{const chapter=book.chapters[index],old=String(chapter.title||'Chapter '+(index+1)),next=old.replace(regex,replacement.replaceAll('{n}',String(number++)));return{index,old,next}}).filter(item=>item.old!==item.next);
   $('renamePreview').innerHTML=changes.length?changes.map(item=>'<div class="rename-preview-row"><span>'+esc(item.old)+'</span><span aria-hidden="true">→</span><b>'+esc(item.next)+'</b></div>').join(''):'<p class="muted tiny">No selected chapter titles would change.</p>';
   $('renameCount').textContent=changes.length+' change'+(changes.length===1?'':'s');
   return changes;
  };
  choices.addEventListener('change',event=>{const input=event.target.closest('[data-rename-chapter]');if(!input)return;const index=Number(input.dataset.renameChapter);if(input.checked)selected.add(index);else selected.delete(index);updateSelection();preview()});
  $('renameChapterSearch').addEventListener('input',renderChoices);
  $('selectAllRenameChapters').onclick=()=>{book.chapters.forEach((_,index)=>selected.add(index));renderChoices();preview()};
  $('clearRenameChapterSelection').onclick=()=>{selected.clear();renderChoices();preview()};
  $('renameChapterOrder').onchange=preview;
  $('previewChapterRename').onclick=preview;
  $('applyChapterRename').onclick=async()=>{
   if(book.locked)return toast('Unlock this novel before renaming chapters');
   const changes=preview();if(!changes?.length)return;
   if(!confirm('Rename '+changes.length+' chapter'+(changes.length===1?'':'s')+'?'))return;
   const now=Date.now();
   for(const item of changes){const chapter=book.chapters[item.index];chapter.history=Array.isArray(chapter.history)?chapter.history:[];chapter.history.push({title:chapter.title||'',text:chapter.text||'',editedAt:now,reason:'Renamed'});chapter.title=item.next;chapter.updatedAt=now}
   book.updated=now;addEditEvent(book,'Chapters renamed',changes.length+' chapter titles');await put(book);await refresh();drawBook();closeModal();toast(changes.length+' chapter'+(changes.length===1?'':'s')+' renamed');
  };
  renderChoices();preview();
 });
}
