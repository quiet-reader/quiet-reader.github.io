import {getAll} from './db.js';

const filterNames={all:'All',epub:'EPUBs',manual:'My novels',pdf:'PDFs',gallery:'Galleries'};
let updateSequence=0;
let scheduled=false;
function matchesSearch(book,query,mode){
 if(!query)return true;
 if(mode==='author')return String(book.author||'').toLocaleLowerCase().includes(query);
 return [book.title,book.author,...(book.chapters||[]).flatMap(chapter=>[chapter.title,chapter.text])]
  .some(value=>String(value||'').toLocaleLowerCase().includes(query));
}
async function updateCounts(){
 const sequence=++updateSequence;
 try{
  const items=await getAll(),books=items.filter(item=>item.kind==='book');
  const query=String(document.getElementById('librarySearch')?.value||'').trim().toLocaleLowerCase();
  const mode=document.getElementById('librarySearchMode')?.value||'everything';
  const tag=document.getElementById('tagFilter')?.value||'all';
  const matching=books.filter(book=>(tag==='all'||(book.tags||[]).includes(tag))&&matchesSearch(book,query,mode));
  if(sequence!==updateSequence)return;
  for(const [filter,label] of Object.entries(filterNames)){
   const button=document.querySelector('[data-filter="'+filter+'"]');
   if(!button)continue;
   let count=button.querySelector('.filter-count');
   if(!count){count=document.createElement('span');count.className='filter-count';count.setAttribute('aria-hidden','true');button.append(count)}
   const total=filter==='all'?matching.length:matching.filter(book=>filter==='gallery'?book.source==='gallery':book.source===filter).length;
   count.textContent=total.toLocaleString();
   button.setAttribute('aria-label',label+', '+total+' '+(total===1?'item':'items'));
   button.title=total+' '+(total===1?'book':'books')+' match the current search and tag filters';
  }
 }catch(error){console.warn('Could not update library counts',error)}
}
function scheduleUpdate(){
 if(scheduled)return;
 scheduled=true;
 queueMicrotask(()=>{scheduled=false;updateCounts()});
}
const grid=document.getElementById('bookGrid');
if(grid)new MutationObserver(scheduleUpdate).observe(grid,{childList:true,subtree:true});
for(const id of ['librarySearch','librarySearchMode','tagFilter']){
 const control=document.getElementById(id);
 control?.addEventListener('input',scheduleUpdate);
 control?.addEventListener('change',scheduleUpdate);
}
window.addEventListener('pageshow',scheduleUpdate);
scheduleUpdate();
