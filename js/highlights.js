import {state} from './state.js';import {put} from './db.js';import {$,esc,toast,modal} from './utils.js';import {openReader} from './reader.js';
function textOffset(root,target,offset){
 const range=document.createRange();
 try{range.selectNodeContents(root);range.setEnd(target,offset);return range.toString().length}catch{return 0}
}
export function hideSelectionToolbar(){const bar=$('selectionToolbar');if(bar)bar.classList.add('hidden')}
export function positionSelectionToolbar(){const bar=$('selectionToolbar'),selection=getSelection(),root=$('readingBody');if(!bar||!selection||selection.isCollapsed||!selection.rangeCount||!root)return hideSelectionToolbar();const range=selection.getRangeAt(0);if(!root.contains(range.commonAncestorContainer)||!selection.toString().trim())return hideSelectionToolbar();const rect=range.getBoundingClientRect(),novelName=$('selectionNovelName');if(novelName)novelName.textContent=state.book?.title||'';bar.classList.remove('hidden');const width=bar.offsetWidth,height=bar.offsetHeight;let left=rect.left+rect.width/2;left=Math.max(width/2+10,Math.min(innerWidth-width/2-10,left));let top=rect.top-height-12;if(top<8)top=Math.min(innerHeight-height-8,rect.bottom+12);bar.style.left=left+'px';bar.style.top=Math.max(8,top)+'px'}
export async function addHighlight(color='yellow',savedRange=null){
 const selection=getSelection(),root=$('readingBody');if(!state.book||!root)return toast('Open a chapter first');
 const range=savedRange?.cloneRange?.()||(selection&&!selection.isCollapsed&&selection.rangeCount?selection.getRangeAt(0).cloneRange():null);
 if(!range||!root.contains(range.startContainer)||!root.contains(range.endContainer))return toast('Select text inside the chapter');
 const raw=range.toString(),quote=raw.trim();if(!quote)return toast('Select some text first');
 const leading=raw.length-raw.trimStart().length,start=textOffset(root,range.startContainer,range.startOffset)+leading,end=start+quote.length;
 state.book.highlights=state.book.highlights||[];state.book.highlights.push({id:crypto.randomUUID?.()||String(Date.now())+Math.random(),chapter:state.chapter,text:quote,start,end,color,note:'',locked:false,created:Date.now()});
 try{await put(state.book);selection?.removeAllRanges();hideSelectionToolbar();renderHighlights();toast('Highlight saved')}catch(error){console.error(error);toast('Could not save highlight')}
}
export async function addParagraphHighlight(paragraph,color='yellow'){
 const root=$('readingBody');if(!state.book||!root)return toast('Open a chapter first');
 if(!paragraph||!root.contains(paragraph)||!paragraph.matches('p,li,blockquote,h1,h2,h3,h4,h5,h6,pre'))return toast('Tap inside a paragraph first');
 const range=document.createRange();range.selectNodeContents(paragraph);const raw=range.toString(),quote=raw.trim();if(!quote)return toast('This paragraph has no text to highlight');
 const leading=raw.length-raw.trimStart().length,start=textOffset(root,range.startContainer,range.startOffset)+leading,end=start+quote.length;
 state.book.highlights=state.book.highlights||[];state.book.highlights.push({id:crypto.randomUUID?.()||String(Date.now())+Math.random(),chapter:state.chapter,text:quote,start,end,color,note:'',locked:false,created:Date.now(),scope:'paragraph'});
 try{await put(state.book);hideSelectionToolbar();getSelection()?.removeAllRanges();renderHighlights();toast('Paragraph highlighted')}catch(error){console.error(error);toast('Could not save paragraph highlight')}
}
export function renderHighlights(){
 const root=$('readingBody');if(!root||!state.book)return;
 root.querySelectorAll('mark[data-highlight]').forEach(mark=>{const parent=mark.parentNode;if(!parent)return;while(mark.firstChild)parent.insertBefore(mark.firstChild,mark);mark.remove()});root.normalize();
 const saved=(state.book.highlights||[]).filter(m=>Number(m.chapter)===Number(state.chapter)&&m.text);if(!saved.length)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let total=0,node;
 while((node=walker.nextNode())){const start=total;total+=node.nodeValue.length;nodes.push({node,start,end:total})}
 const fullText=nodes.map(x=>x.node.nodeValue).join('');
 const normalizeWithMap=value=>{let out='',map=[];for(let i=0;i<value.length;i++){const c=value[i];if(/\\s/.test(c)){if(!out.endsWith(' ')){out+=' ';map.push(i)}}else{out+=c;map.push(i)}}return {text:out,map}};
 const normalized=normalizeWithMap(fullText);
 const ranges=saved.map(m=>{let start=Number(m.start),end=Number(m.end);if(!Number.isInteger(start)||!Number.isInteger(end)||end<=start||fullText.slice(start,end)!==m.text){
   let found=fullText.indexOf(m.text);
   if(found<0){const quote=String(m.text).replace(/\\s+/g,' ').trim(),at=normalized.text.indexOf(quote);if(at<0)return null;start=normalized.map[at];end=normalized.map[at+quote.length-1]+1}
   else{start=found;end=found+m.text.length}
  }return {...m,start,end}}).filter(Boolean);
 // Build each original text node from immutable offsets. This avoids splitText offset drift
 // when a highlight starts and ends inside the same text node or overlaps another mark.
 for(const item of nodes){if(!item.node.isConnected)continue;const value=item.node.nodeValue,overlaps=ranges.filter(m=>m.end>item.start&&m.start<item.end);if(!overlaps.length)continue;const cuts=[item.start,item.end,...overlaps.flatMap(m=>[Math.max(item.start,m.start),Math.min(item.end,m.end)])].sort((a,b)=>a-b).filter((v,i,a)=>i===0||v!==a[i-1]);const fragment=document.createDocumentFragment();for(let i=0;i<cuts.length-1;i++){const from=cuts[i],to=cuts[i+1];if(to<=from)continue;const chosen=overlaps.filter(m=>m.start<=from&&m.end>=to).sort((a,b)=>(b.created||0)-(a.created||0))[0];const textNode=document.createTextNode(value.slice(from-item.start,to-item.start));if(chosen){const mark=document.createElement('mark');mark.dataset.highlight=chosen.id;mark.dataset.color=chosen.color||'yellow';mark.append(textNode);fragment.append(mark)}else fragment.append(textNode)}item.node.replaceWith(fragment)}
}
async function removeMark(book,kind,id){const mark=(book[kind]||[]).find(x=>x.id===id);if(mark?.locked)return toast('Unlock this saved item before deleting it');book[kind]=(book[kind]||[]).filter(x=>x.id!==id);await put(book);showMarks()}
async function toggleMarkLock(book,kind,id){const mark=(book[kind]||[]).find(x=>x.id===id);if(!mark)return;mark.locked=!mark.locked;await put(book);showMarks();toast(mark.locked?'Saved item locked':'Saved item unlocked')}
export function showMarks(){
 const books=state.books?.length?state.books:(state.book?[state.book]:[]);
 const allEntries=books.flatMap(book=>[...(book.bookmarks||[]).map(x=>({...x,type:'Bookmark',kind:'bookmarks',bookId:book.id,bookTitle:book.title,bookAuthor:book.author})),...(book.highlights||[]).map(x=>({...x,type:'Highlight',kind:'highlights',bookId:book.id,bookTitle:book.title,bookAuthor:book.author}))]).sort((a,b)=>(b.created||0)-(a.created||0));
 let activeTab='highlights';let searchQuery='';
 const renderEntries=()=>{
  const needle=searchQuery.trim().toLocaleLowerCase();
  const entries=allEntries.filter(x=>x.kind===activeTab&&(!needle||[x.bookTitle,x.bookAuthor,x.text,(books.find(b=>b.id===x.bookId)?.chapters||[])[Number(x.chapter)]?.title].some(v=>String(v||'').toLocaleLowerCase().includes(needle))));
  const label=activeTab==='highlights'?'highlights':'bookmarks';
  const html=entries.length?entries.map(x=>'<div class="modal-item saved-mark-item"><div class="saved-mark-meta"><span class="saved-mark-type '+x.type.toLowerCase()+'">'+(x.type==='Bookmark'?'★ Bookmark':'✦ Highlight')+'</span><b>'+esc(x.bookTitle||'Untitled novel')+'</b><span class="muted tiny">Chapter '+(Number(x.chapter)+1)+'</span>'+(x.locked?'<span class="saved-mark-lock">🔒 Locked</span>':'')+'</div><div class="saved-mark-actions"><button data-goto="'+x.chapter+'" data-kind="'+x.kind+'" data-mark-id="'+esc(x.id)+'" data-anchor-offset="'+(x.kind==='bookmarks'?(Number(x.anchorOffset??(Number(x.offset||0)+innerHeight/2))||0):'')+'" data-book-id="'+esc(x.bookId)+'">Open</button><button data-toggle-mark-lock="'+esc(x.id)+'" data-kind="'+x.kind+'" data-book-id="'+esc(x.bookId)+'">'+(x.locked?'Unlock':'Lock')+'</button><button data-remove-mark="'+esc(x.id)+'" data-kind="'+x.kind+'" data-book-id="'+esc(x.bookId)+'" '+(x.locked?'disabled title="Unlock before deleting"':'')+'>Delete</button></div>'+(x.type==='Highlight'?'<div class="saved-highlight-color" data-color="'+esc(x.color||'yellow')+'"></div>':'')+'<p>'+esc(x.text||'Saved reading position')+'</p>'+(x.type==='Highlight'?'<label>Note<textarea data-note="'+esc(x.id)+'" data-book-id="'+esc(x.bookId)+'" rows="2">'+esc(x.note||'')+'</textarea></label>':'')+'</div>').join(''):'<p class="muted saved-marks-empty">No '+label+' saved yet.</p>';
  $('savedMarksList').innerHTML=html;
  document.querySelectorAll('[data-mark-tab]').forEach(button=>{const selected=button.dataset.markTab===activeTab;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected))});
 };
 modal('Saved reading marks','<div class="saved-marks-search"><input id="savedMarksSearch" type="search" placeholder="Search by novel, author, or saved text…" autocomplete="off"></div><div class="saved-marks-tabs" role="tablist" aria-label="Saved reading marks"><button type="button" role="tab" data-mark-tab="highlights" aria-pressed="true">✦ Highlights</button><button type="button" role="tab" data-mark-tab="bookmarks" aria-pressed="false">★ Bookmarks</button></div><div id="savedMarksList" class="saved-marks-list"></div>',()=>{
  renderEntries();
  $('savedMarksSearch').oninput=e=>{searchQuery=e.target.value;renderEntries()};
  $('modalHost').onclick=async e=>{
   const tab=e.target.closest('[data-mark-tab]');if(tab){activeTab=tab.dataset.markTab;renderEntries();return}
   const go=e.target.closest('[data-goto]');if(go){const book=state.books.find(x=>x.id===go.dataset.bookId)||books.find(x=>x.id===go.dataset.bookId);if(!book)return;state.book=book;$('modalHost').innerHTML='';openReader(Number(go.dataset.goto));if(go.dataset.kind==='highlights'){requestAnimationFrame(()=>{const mark=$('readingBody')?.querySelector('mark[data-highlight="'+go.dataset.markId+'"]');mark?.scrollIntoView({behavior:'smooth',block:'center'})})}else{const anchor=Number(go.dataset.anchorOffset);if(Number.isFinite(anchor)&&anchor>0)requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,anchor-innerHeight/2),behavior:'smooth'}))}return}
   const lock=e.target.closest('[data-toggle-mark-lock]');if(lock){const book=state.books.find(x=>x.id===lock.dataset.bookId)||books.find(x=>x.id===lock.dataset.bookId);if(book)await toggleMarkLock(book,lock.dataset.kind,lock.dataset.toggleMarkLock);return}
   const del=e.target.closest('[data-remove-mark]');if(del){const book=state.books.find(x=>x.id===del.dataset.bookId)||books.find(x=>x.id===del.dataset.bookId);if(book)await removeMark(book,del.dataset.kind,del.dataset.removeMark)}
  };
  $('modalHost').onchange=async e=>{const id=e.target.dataset.note;if(!id)return;const book=state.books.find(x=>x.id===e.target.dataset.bookId)||books.find(x=>x.id===e.target.dataset.bookId);const mark=book?.highlights?.find(x=>x.id===id);if(mark){mark.note=e.target.value;await put(book)}};
 });
}
export async function bookmarkFromSelection(){const book=state.book;if(!book)return toast('Open a novel first');book.bookmarks=book.bookmarks||[];if(book.bookmarks.some(x=>Number(x.chapter)===Number(state.chapter)))return toast('This chapter is already bookmarked');const selection=getSelection(),range=selection&&!selection.isCollapsed&&selection.rangeCount?selection.getRangeAt(0):null,rect=range?.getBoundingClientRect(),anchorOffset=rect&&rect.height?window.scrollY+rect.top+rect.height/2:window.scrollY+window.innerHeight/2;book.bookmarks.push({id:crypto.randomUUID?.()||String(Date.now()),chapter:state.chapter,offset:window.scrollY,anchorOffset,text:range?.toString().trim()||$('readingTitle')?.textContent||'Chapter '+(state.chapter+1),created:Date.now(),locked:false});await put(book);hideSelectionToolbar();getSelection()?.removeAllRanges();toast('Bookmark saved')}
export function afterReaderRender(){renderHighlights()}
