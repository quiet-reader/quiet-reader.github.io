import {put} from './db.js';
import {state} from './state.js';
import {$,esc,modal,closeModal} from './utils.js';

const UNIVERSAL_HISTORY_KEY='qrUniversalHistoryV1';
const UNIVERSAL_HISTORY_LOCK_KEY='qrUniversalHistoryClearLocked';
const dateTime=value=>Number.isFinite(Number(value))&&Number(value)>0?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(Number(value))):'Date unavailable';
function readUniversalHistory(){try{const raw=localStorage.getItem(UNIVERSAL_HISTORY_KEY);return raw===null?null:JSON.parse(raw)}catch(error){return null}}
function writeUniversalHistory(entries){try{localStorage.setItem(UNIVERSAL_HISTORY_KEY,JSON.stringify(entries));return true}catch(error){console.warn('Could not save universal history',error);return false}}
function appendUniversalHistory(entry){
 let entries=readUniversalHistory();
 if(entries===null)entries=(state.books||[]).flatMap(book=>[
  ...(book.readingHistory||[]).map(item=>({...item,kind:'reading',bookId:book.id,bookTitle:book.title||'Untitled novel'})),
  ...(book.editHistory||[]).map(item=>({...item,kind:'edit',bookId:book.id,bookTitle:book.title||'Untitled novel'}))
 ]);
 entries.push(entry);
 writeUniversalHistory(entries);
}
function getUniversalHistory(books){
 let entries=readUniversalHistory();
 if(entries===null){
  entries=(books||[]).flatMap(book=>[
   ...(book.readingHistory||[]).map(item=>({...item,kind:'reading',bookId:book.id,bookTitle:book.title||'Untitled novel'})),
   ...(book.editHistory||[]).map(item=>({...item,kind:'edit',bookId:book.id,bookTitle:book.title||'Untitled novel'}))
  ]);
  writeUniversalHistory(entries);
 }
 return entries.sort((a,b)=>(Number(b.visitedAt||b.editedAt)||0)-(Number(a.visitedAt||a.editedAt)||0));
}
export function addEditEvent(book,action,detail=''){
 if(!book)return;
 const now=Date.now();
 book.editHistory=Array.isArray(book.editHistory)?book.editHistory:[];
 const event={action:String(action||'Edited'),detail:String(detail||''),editedAt:now};
 book.editHistory.push(event);
 book.editHistory=book.editHistory.slice(-10);
 appendUniversalHistory({...event,kind:'edit',bookId:book.id,bookTitle:book.title||'Untitled novel'});
}
export async function recordReading(book,chapterIndex,offset=0){
 if(!book||!Number.isInteger(Number(chapterIndex)))return;
 const now=Date.now(),chapter=book.chapters?.[Number(chapterIndex)];if(!chapter)return;
 const history=Array.isArray(book.readingHistory)?book.readingHistory:[];
 const last=history[history.length-1];
 let event;
 if(last&&Number(last.chapterIndex)===Number(chapterIndex)&&now-Number(last.visitedAt)<30000){
  last.visitedAt=now;last.offset=Math.max(0,Number(offset)||0);last.chapterTitle=chapter.title||'Chapter '+(Number(chapterIndex)+1);
  event={...last};
 }else{
  event={chapterIndex:Number(chapterIndex),chapterTitle:chapter.title||'Chapter '+(Number(chapterIndex)+1),visitedAt:now,offset:Math.max(0,Number(offset)||0)};
  history.push(event);
  appendUniversalHistory({...event,kind:'reading',bookId:book.id,bookTitle:book.title||'Untitled novel'});
 }
 book.readingHistory=history.slice(-10);await put(book);
 const bookIndex=state.books?.findIndex(item=>item.id===book.id);if(bookIndex>=0)state.books[bookIndex]=book;
}
export function novelHistoryMarkup(book){
 const reads=[...(book?.readingHistory||[])].slice(-10).reverse();
 const edits=[...(book?.editHistory||[])].slice(-10).reverse();
 const reading=reads.map(item=>'<button type="button" class="reading-history-entry" data-open-reading-history="'+esc(book.id)+'" data-history-chapter="'+Number(item.chapterIndex)+'"><span class="reading-history-copy"><b>'+esc(item.chapterTitle||'Chapter '+(Number(item.chapterIndex)+1))+'</b><small>'+esc(dateTime(item.visitedAt))+'</small></span><span class="muted tiny">Open ↗</span></button>').join('');
 const editing=edits.map(item=>'<div class="reading-history-entry edit-history-entry"><span class="reading-history-copy"><b>✎ '+esc(item.action)+'</b><small>'+esc(item.detail||'')+' · '+esc(dateTime(item.editedAt))+'</small></span></div>').join('');
 return (reading?'<h3>Reading · last 10</h3><div class="reading-history-list">'+reading+'</div>':'<div class="empty">No reading history for this novel yet.</div>')+(editing?'<h3>Editing activity · last 10</h3><div class="reading-history-list">'+editing+'</div>':'<p class="muted tiny">No editing activity recorded yet.</p>');
}
export function showUniversalHistory(books,onOpen){
 let entries=getUniversalHistory(books);
 let locked=localStorage.getItem(UNIVERSAL_HISTORY_LOCK_KEY)!=='false';
 const body='<div class="universal-history-tools"><input id="universalHistorySearch" type="search" placeholder="Search books, chapters, actions…" autocomplete="off" aria-label="Search universal history"><div class="row wrap"><span id="universalHistoryCount" class="muted tiny"></span><span class="grow"></span><button type="button" id="universalHistoryLock">'+(locked?'🔒 Locked':'🔓 Unlocked')+'</button><button type="button" id="universalHistoryClear" class="danger" '+(locked?'disabled':'')+'>Clear history</button></div></div><div id="universalHistoryList" class="reading-history-list"></div>';
 modal('Universal history',body,()=>{
  document.querySelector('#modalHost .modal')?.classList.add('reading-history-modal','universal-history-modal');
  const list=$('universalHistoryList'),search=$('universalHistorySearch'),count=$('universalHistoryCount'),lockButton=$('universalHistoryLock'),clearButton=$('universalHistoryClear');
  const render=()=>{
   const query=search.value.trim().toLocaleLowerCase();
   const filtered=entries.filter(item=>[item.bookTitle,item.chapterTitle,item.action,item.detail,item.kind,dateTime(item.visitedAt||item.editedAt)].join(' ').toLocaleLowerCase().includes(query));
   count.textContent=filtered.length+' of '+entries.length+' entries';
   list.innerHTML=filtered.length?filtered.map(item=>item.kind==='reading'?'<button type="button" class="reading-history-entry" data-global-history-book="'+esc(item.bookId)+'" data-history-chapter="'+Number(item.chapterIndex)+'"><span class="reading-history-copy"><b>'+esc(item.bookTitle||'Untitled novel')+'</b><small>'+esc(item.chapterTitle||'Chapter '+(Number(item.chapterIndex)+1))+' · '+esc(dateTime(item.visitedAt))+'</small></span><span class="muted tiny">Read ↗</span></button>':'<div class="reading-history-entry edit-history-entry"><span class="reading-history-copy"><b>'+esc(item.bookTitle||'Untitled novel')+' · ✎ '+esc(item.action||'Edited')+'</b><small>'+esc(item.detail||'')+' · '+esc(dateTime(item.editedAt))+'</small></span></div>').join(''):'<div class="empty">'+(entries.length?'No matching history.':'Reading and editing activity will appear here.')+'</div>';
   lockButton.textContent=locked?'🔒 Locked':'🔓 Unlocked';clearButton.disabled=locked;
  };
  search.oninput=render;
  lockButton.onclick=()=>{locked=!locked;localStorage.setItem(UNIVERSAL_HISTORY_LOCK_KEY,String(locked));render()};
  clearButton.onclick=()=>{
   if(locked)return;
   if(!confirm('Clear the universal history? This will not delete individual novel or gallery history.'))return;
   entries=[];writeUniversalHistory(entries);render();
  };
  $('modalHost').onclick=event=>{
   const row=event.target.closest('[data-global-history-book]');if(!row)return;
   const book=(books||[]).find(item=>item.id===row.dataset.globalHistoryBook);
   if(book&&onOpen){closeModal();onOpen(book,Number(row.dataset.historyChapter))}
  };
  render();
 });
}
