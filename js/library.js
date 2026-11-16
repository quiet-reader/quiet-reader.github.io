import {state,freshBook,setScreen} from './state.js';import {getAll,put,remove} from './db.js';import {$,esc,toast,modal,closeModal} from './utils.js';import {openReader} from './reader.js';import {novelHistoryMarkup,addEditEvent} from './history.js';
let currentBookTab='chapters';
let librarySearchQuery='';
let librarySearchMode='everything';
const COLLECTION_KEY='qrCollections';
function readCollections(){try{const value=JSON.parse(localStorage.getItem(COLLECTION_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}}
function writeCollections(value){localStorage.setItem(COLLECTION_KEY,JSON.stringify(value))}
function collectionRef(type,book,index){
 const child=type==='chapter'?book.chapters?.[index]:null;
 if(type==='chapter'&&child)return{type,bookId:book.id,chapterId:child.id||(child.id='chapter-'+Date.now()+'-'+index)};
 if(type==='image')return{type:'image',bookId:book.id,imageId:book.gallery?.images?.[index]?.id};
 return{type:book.source==='gallery'?'gallery':'book',bookId:book.id};
}
export async function addCollectionItem(ref){
 if(!ref)return;
 const all=readCollections(),collection=all.find(item=>item.id===state.collectionId);
 if(!collection)return toast('Open a collection first');
 const same=item=>item.type===ref.type&&item.bookId===ref.bookId&&(item.chapterId||'')===(ref.chapterId||'')&&(item.imageId||'')===(ref.imageId||'');
 if(collection.items.some(same))return toast('Already in this collection');
 collection.items.push({...ref});writeCollections(all);drawLibrary();toast('Added to collection');
}
export async function addToCollection(type,book,index){
 if(!book)return;
 if(type==='chapter'){const child=book.chapters?.[index];if(child&&!child.id)child.id='chapter-'+Date.now()+'-'+index;await put(book)}
 const ref=collectionRef(type,book,index),collections=readCollections();
 const render=()=>{$('collectionPickerList').innerHTML=collections.length?collections.map((c,i)=>{const exists=c.items.some(x=>x.type===ref.type&&x.bookId===ref.bookId&&(x.chapterId||'')===(ref.chapterId||'')&&(x.imageId||'')===(ref.imageId||''));return '<label class="collection-picker-item"><input type="checkbox" data-pick-collection="'+i+'" '+(exists?'checked':'')+'><span>'+esc(c.name)+'</span><small>'+c.items.length+' items</small></label>'}).join(''):'<p class="muted tiny">Create a collection to start saving entries.</p>'};
 modal('Add to collection','<div class="stack"><p class="muted tiny">Save this '+(type==='chapter'?'chapter':type==='image'?'image':type==='gallery'?'gallery':'novel')+' to one or more collections.</p><div class="row"><input id="collectionNewName" placeholder="New collection name" maxlength="48"><button id="collectionCreate" class="primary" type="button">Create</button></div><div id="collectionPickerList" class="collection-picker-list"></div></div>',()=>{
  render();$('collectionCreate').onclick=()=>{const name=$('collectionNewName').value.trim();if(!name)return toast('Enter a collection name');if(collections.some(c=>c.name.toLowerCase()===name.toLowerCase()))return toast('Collection already exists');collections.push({id:'collection-'+Date.now()+'-'+Math.random().toString(36).slice(2),name,createdAt:new Date().toISOString(),items:[],tags:[]});writeCollections(collections);$('collectionNewName').value='';render()};
  $('collectionPickerList').onchange=e=>{const input=e.target.closest('[data-pick-collection]');if(!input)return;const c=collections[Number(input.dataset.pickCollection)];const i=c.items.findIndex(x=>x.type===ref.type&&x.bookId===ref.bookId&&(x.chapterId||'')===(ref.chapterId||'')&&(x.imageId||'')===(ref.imageId||''));if(input.checked&&i<0)c.items.push(ref);if(!input.checked&&i>=0)c.items.splice(i,1);writeCollections(collections);render()};
 });
}
function collectionEscape(value){return esc(String(value??''))}
function collectionDisplaySettings(){return{view:localStorage.getItem('qrLibraryView')||'expanded',columns:Math.max(1,Math.min(6,Number(localStorage.getItem('qrLibraryColumns')||3)))}}
function drawCollections(grid){
 const collections=readCollections(),active=state.collectionId?collections.find(c=>c.id===state.collectionId):null;
 document.body.classList.toggle('collection-fullscreen',Boolean(active));
 const {view,columns}=collectionDisplaySettings();
 grid.style.setProperty('--library-columns',String(columns));grid.classList.toggle('compact-view',view==='compact');grid.classList.toggle('expanded-view',view!=='compact');
 if(!active){
  grid.innerHTML='<div class="collections-heading"><div><span class="section-kicker">YOUR SAVED GROUPS</span><h2>Collections</h2></div><button id="createCollectionButton" class="primary collection-create-plus" aria-label="Create collection" title="Create collection">＋</button></div>';
  if(!collections.length){grid.innerHTML+='<div class="empty-state"><span class="empty-icon">▣</span><h2>No collections yet.</h2><p>Create a collection, then save novels, galleries, chapters or images into it.</p></div>';return}
  grid.innerHTML+='<div class="book-grid collection-index-grid '+(view==='compact'?'compact-view':'expanded-view')+'" style="--library-columns:'+columns+'">'+collections.map(c=>{
   const cover=c.cover||'',tags=(c.tags||[]).map(tag=>'<span class="book-tag">#'+collectionEscape(tag)+'</span>').join('');
   return '<article class="book-card collection-index-card" data-open-collection="'+collectionEscape(c.id)+'"><div class="book-cover">'+(cover?'<img src="'+cover+'" alt="">':'<div class="cover-placeholder"><span>▣</span><small>COLLECTION</small></div>')+'</div><div class="book-info"><div class="card-topline"><span class="library-type-badge">COLLECTION</span><span class="card-updated">'+(c.items||[]).length+' items</span></div><div class="book-title">'+collectionEscape(c.name)+'</div><div class="book-subtitle">'+collectionEscape(c.author||'Saved items')+'</div>'+(tags?'<div class="book-tags">'+tags+'</div>':'')+'<div class="actions"><button class="card-open-action" data-open-collection="'+collectionEscape(c.id)+'">Open</button><button data-edit-collection="'+collectionEscape(c.id)+'" aria-label="Edit collection" title="Edit collection">✎</button><button class="card-delete-action" data-delete-collection="'+collectionEscape(c.id)+'" aria-label="Delete collection">×</button></div></div></article>';
  }).join('')+'</div>';return;
 }
 const itemCards=active.items.map((item,index)=>{
  const book=state.books.find(x=>x.id===item.bookId);
  const chapter=book&&item.type==='chapter'?(book.chapters||[]).find(x=>x.id===item.chapterId):null;
  const image=book&&item.type==='image'?(book.gallery?.images||[]).find(x=>x.id===item.imageId):null;
  const localImage=item.type==='image'&&String(item.bookId).startsWith('collection:');
  if(!localImage&&!book)return '';if(item.type==='image'&&!localImage&&!image)return '';
  const title=localImage?item.name:image?.name||chapter?.title||book?.title||'Untitled';
  const subtitle=localImage?'Image':image?'Image · '+book.title:chapter?'Chapter · '+book.title:book?.source==='gallery'?'Gallery':'Novel';
  const cover=localImage?item.data:image?.data||book?.cover||(book?.gallery?.images||[])[0]?.data||'';
  const kind=localImage||image?'IMAGE':chapter?'CHAPTER':book?.source==='gallery'?'GALLERY':'NOVEL';
  return '<article class="book-card collection-item-card" data-collection-open="'+index+'"><div class="book-cover">'+(cover?'<img loading="lazy" src="'+cover+'" alt="">':'<div class="cover-placeholder"><span>q.</span></div>')+'</div><div class="book-info"><div class="card-topline"><span class="library-type-badge">'+kind+'</span></div><div class="book-title">'+collectionEscape(title)+'</div><div class="book-subtitle">'+collectionEscape(subtitle)+'</div><div class="actions"><button class="card-open-action" data-collection-open="'+index+'">Open</button><button class="card-delete-action" data-collection-remove="'+index+'" aria-label="Remove item" title="Remove item">×</button></div></div></article>';
 }).join('');
 const tags=(active.tags||[]).map(tag=>'<span class="book-tag">#'+collectionEscape(tag)+'</span>').join('');
 grid.innerHTML='<section class="collection-detail-head"><div class="collection-detail-title-row"><button class="text-button" data-collection-back>← Collections</button><span class="grow"></span><button type="button" data-edit-collection="'+collectionEscape(active.id)+'" title="Edit collection" aria-label="Edit collection">✎</button><button type="button" data-collection-add-images title="Add images" aria-label="Add images">＋</button><input id="collectionImageFiles" type="file" accept="image/*" multiple hidden></div><div class="collection-detail-meta"><div class="collection-detail-cover">'+(active.cover?'<img src="'+active.cover+'" alt="">':'▣')+'</div><div class="grow"><h2>'+collectionEscape(active.name)+'</h2><p>'+collectionEscape(active.author||'Collection')+' · '+active.items.length+' items</p><div class="book-tags">'+tags+'</div></div></div><div class="collection-view-controls"><button type="button" data-collection-view="expanded" class="'+(view==='expanded'?'active':'')+'">▦ Cards</button><button type="button" data-collection-view="compact" class="'+(view==='compact'?'active':'')+'">☷ Compact</button><label>Columns <select id="collectionColumns">'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'" '+(n===columns?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div></section><div class="book-grid collection-items-grid '+(view==='compact'?'compact-view':'expanded-view')+'" style="--library-columns:'+columns+'">'+(itemCards||'<div class="empty-state"><h2>This collection is empty.</h2><p>Add novels, galleries, chapters or images using the collection action on an item.</p></div>')+'</div>';
 const imageInput=$('collectionImageFiles');if(imageInput)imageInput.onchange=async e=>{const selected=[...e.target.files].filter(file=>file.type.startsWith('image/'));for(const file of selected){const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file)});active.items.push({type:'image',bookId:'collection:'+active.id,imageId:'image-'+Date.now()+'-'+Math.random().toString(36).slice(2),name:file.name,data,size:file.size})}writeCollections(collections);drawLibrary();if(selected.length)toast(selected.length+' image'+(selected.length===1?'':'s')+' added');e.target.value=''};
 const select=$('collectionColumns');if(select)select.onchange=e=>{localStorage.setItem('qrLibraryColumns',e.target.value);drawLibrary()};
}
export function handleCollectionAction(event){
 const open=event.target.closest('[data-open-collection]');if(open){state.collectionId=open.dataset.openCollection;drawLibrary();return true}
 if(event.target.closest('[data-collection-back]')){state.collectionId=null;drawLibrary();return true}
 const edit=event.target.closest('[data-edit-collection]');if(edit){const all=readCollections(),c=all.find(x=>x.id===edit.dataset.editCollection);if(!c)return true;modal('Edit collection','<div class="stack"><label>Name<input id="editCollectionName" value="'+collectionEscape(c.name)+'"></label><label>Author<input id="editCollectionAuthor" value="'+collectionEscape(c.author||'')+'"></label><label>Tags<input id="editCollectionTags" value="'+collectionEscape((c.tags||[]).join(', '))+'"></label><label>Cover image<input id="editCollectionCover" type="file" accept="image/*"></label><div class="row"><button type="button" id="pasteCollectionCover">Paste cover</button><span class="grow"></span><button id="saveCollectionMeta" class="primary">Save</button></div></div>',()=>{
  $('saveCollectionMeta').onclick=async()=>{c.name=$('editCollectionName').value.trim()||c.name;c.author=$('editCollectionAuthor').value.trim();c.tags=[...new Set($('editCollectionTags').value.split(',').map(x=>x.trim().replace(/^#/,'')).filter(Boolean))];const file=$('editCollectionCover').files[0];if(file)c.cover=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file)});writeCollections(all);closeModal();drawLibrary()};
  $('pasteCollectionCover').onclick=async()=>{try{const items=await navigator.clipboard.read();for(const entry of items){const type=entry.types.find(x=>x.startsWith('image/'));if(type){const blob=await entry.getType(type);c.cover=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob)});$('editCollectionCover').dataset.pasted='1';toast('Cover pasted');return}}toast('No image found in clipboard')}catch{toast('Clipboard image access unavailable')}};
 });return true}
 const addImages=event.target.closest('[data-collection-add-images]');if(addImages){$('collectionImageFiles')?.click();return true}
 const view=event.target.closest('[data-collection-view]');if(view){localStorage.setItem('qrLibraryView',view.dataset.collectionView);drawLibrary();return true}
 const del=event.target.closest('[data-delete-collection]');if(del){writeCollections(readCollections().filter(c=>c.id!==del.dataset.deleteCollection));drawLibrary();return true}
 const removeItem=event.target.closest('[data-collection-remove]');if(removeItem){const all=readCollections(),c=all.find(x=>x.id===state.collectionId);if(c)c.items.splice(Number(removeItem.dataset.collectionRemove),1);writeCollections(all);drawLibrary();return true}
 const openItem=event.target.closest('[data-collection-open]');if(openItem){const c=readCollections().find(x=>x.id===state.collectionId),item=c?.items[Number(openItem.dataset.collectionOpen)];if(item?.type==='image'&&String(item.bookId).startsWith('collection:')){modal(item.name||'Collection image','<img class="collection-image-preview" src="'+item.data+'" alt="">');return true}const book=state.books.find(x=>x.id===item?.bookId);if(book){if(item.type==='chapter'){state.book=book;openReader((book.chapters||[]).findIndex(ch=>ch.id===item.chapterId))}else if(item.type==='image'){state.book=book;import('./galleries.js').then(module=>module.openGalleryImageById(item.imageId))}else openBook(book.id)}return true}
 const add=event.target.closest('[data-add-to-collection]');if(add){const book=state.books.find(x=>x.id===add.dataset.bookId);if(book)addToCollection(add.dataset.addToCollection,book,Number(add.dataset.chapterIndex));return true}
 const addImage=event.target.closest('[data-add-gallery-image-to-collection]');if(addImage){const book=state.books.find(x=>x.id===addImage.dataset.bookId);if(book)addToCollection('image',book,Number(addImage.dataset.imageIndex));return true}
 return false;
}
const dateTime=value=>Number.isFinite(Number(value))&&Number(value)>0?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(Number(value))):'Date unavailable';
function updatedLabel(value){
 const time=Number(value)||0;if(!time)return 'Added recently';
 const age=Math.max(0,Date.now()-time),minutes=Math.floor(age/60000),hours=Math.floor(age/3600000),days=Math.floor(age/86400000);
 if(minutes<1)return 'Updated just now';if(minutes<60)return 'Updated '+minutes+'m ago';if(hours<24)return 'Updated '+hours+'h ago';if(days<7)return 'Updated '+days+'d ago';
 return 'Updated '+new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(time));
}
const defaultTagColors=['#d7c477','#83b8e8','#8bc58b','#e7a0bd','#b9a0e8','#e5a16b','#72c5bd','#d58f8f'];
function savedTagColors(){try{return JSON.parse(localStorage.getItem('qrTagColors')||'{}')}catch{return {}}}
function tagColor(tag,index){return savedTagColors()[tag]||defaultTagColors[index%defaultTagColors.length]}
export async function refresh(){const items=await getAll();state.books=items.filter(x=>x.kind==='book');state.pastes=items.filter(x=>x.kind==='paste');drawLibrary()}
export function drawLibrary(){
 document.body.classList.toggle('collection-fullscreen',state.filter==='collections'&&Boolean(state.collectionId));
 $('bookGrid')?.classList.toggle('collection-workspace',state.filter==='collections');
 const entryDefaults=[['all','All entries'],['epub','EPUB'],['manhwa','Manhwa'],['pdf','PDF'],['manual','Novels'],['gallery','Galleries']];
 let entryConfig={};try{entryConfig=JSON.parse(localStorage.getItem('qrLibraryEntryConfig')||'{}')||{}}catch{entryConfig={}}
 document.querySelectorAll('#libraryEntryTabs [data-filter]').forEach(button=>{const key=button.dataset.filter,config=entryConfig[key]||{};button.textContent=config.label||entryDefaults.find(item=>item[0]===key)?.[1]||key;button.classList.toggle('hidden',config.visible===false)});
 const savedCategories=(()=>{try{const value=JSON.parse(localStorage.getItem('qrLibraryCategories')||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.trim()):[]}catch{return []}})();
 const availableTags=[...new Set([...state.books.flatMap(b=>Array.isArray(b.tags)?b.tags:[]).map(t=>String(t).trim()).filter(Boolean),...savedCategories])].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
 const tagSelect=$('tagFilter');
 if(tagSelect){const selected=state.tagFilter||'all';tagSelect.innerHTML='<option value="all">All tags</option>'+availableTags.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');tagSelect.value=availableTags.includes(selected)?selected:'all';state.tagFilter=tagSelect.value}
 const categoryHost=$('customCategoryFilters');if(categoryHost){categoryHost.innerHTML=savedCategories.filter(tag=>entryConfig['tag:'+tag]?.visible!==false).map(tag=>'<button type="button" data-category-filter="'+esc(tag)+'" class="'+(state.tagFilter===tag?'active':'')+'">'+esc(entryConfig['tag:'+tag]?.label||tag)+'</button>').join('')}
 const query=librarySearchQuery.trim().toLocaleLowerCase();
 const stamp=value=>typeof value==='number'?value:(Date.parse(value)||Number(value)||0);
 if(state.filter==='collections'){document.querySelector('.filter-row')?.classList.add('hidden');drawCollections($('bookGrid'));$('pasteList').innerHTML='';$('pastesSection')?.classList.add('hidden');return}
 document.querySelector('.filter-row')?.classList.remove('hidden');$('pastesSection')?.classList.remove('hidden');
 const authorMatches=query?state.books.filter(b=>String(b.author||'').toLocaleLowerCase().includes(query)):[];
 const preferAuthor=authorMatches.length>0;
 const list=state.books.filter(b=>{
  if(state.filter==='gallery'&&b.source!=='gallery')return false;if(state.filter==='manual'&&!['manual','lnreader'].includes(b.source))return false;if(state.filter==='manhwa'&&b.source!=='manhwa')return false;if(state.filter!=='all'&&state.filter!=='gallery'&&state.filter!=='manual'&&state.filter!=='manhwa'&&b.source!==state.filter)return false;
  if(state.tagFilter!=='all'&&!(b.tags||[]).includes(state.tagFilter))return false;
  if(!query)return true;
  if(preferAuthor)return String(b.author||'').toLocaleLowerCase().includes(query);
  return [b.title,b.author,...(b.tags||[]),...(b.chapters||[]).flatMap(ch=>[ch.title,ch.text]),...(b.gallery?.images||[]).flatMap(image=>[image.name,image.title,image.fileName])].some(value=>String(value||'').toLocaleLowerCase().includes(query));
 });const sort=$('librarySort')?.value||localStorage.getItem('qrLibrarySort')||'recent';list.sort((a,b)=>{const chars=x=>(x.chapters||[]).reduce((sum,ch)=>sum+String(ch.text||'').length,0);if(sort==='added')return stamp(b.createdAt||b.addedAt||b.importedAt||b.updated)-stamp(a.createdAt||a.addedAt||a.importedAt||a.updated);if(sort==='pinned')return Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||(b.updated||0)-(a.updated||0);if(sort==='favorite')return Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||(b.updated||0)-(a.updated||0);if(sort==='title')return String(a.title||'').localeCompare(String(b.title||''));if(sort==='rating-asc')return (Number(a.rating)||0)-(Number(b.rating)||0);if(sort==='rating-desc')return (Number(b.rating)||0)-(Number(a.rating)||0);if(sort==='characters-desc')return chars(b)-chars(a);if(sort==='characters-asc')return chars(a)-chars(b);return stamp(b.updated)-stamp(a.updated)});const grid=$('bookGrid');
 grid.innerHTML='';
 const view=localStorage.getItem('qrLibraryView')||'expanded';const columns=Math.max(2,Math.min(5,Number(localStorage.getItem('qrLibraryColumns')||3)));grid.style.setProperty('--library-columns',String(columns));grid.classList.toggle('compact-view',view==='compact');grid.classList.toggle('expanded-view',view!=='compact');document.querySelectorAll('[data-library-view]').forEach(button=>{button.classList.toggle('active',button.dataset.libraryView===view);button.setAttribute('aria-pressed',String(button.dataset.libraryView===view))});
 if(!list.length){
  const isGallery=state.filter==='gallery';
  const isEmptyLibrary=!state.books.length;
  grid.innerHTML=isGallery
   ? '<div class="empty-state"><span class="empty-icon">▧</span><h2>Your galleries are waiting.</h2><p>Create a gallery or add images to begin.</p></div>'
   : isEmptyLibrary
    ? '<div class="empty-state"><span class="empty-icon">▤</span><h2>Your library is waiting.</h2><p>Add to your library to see your stories here.</p></div>'
    : '<div class="empty">No entries in this category yet.</div>';
 }
 for(const b of list){
  const gallery=b.source==='gallery';
  const card=document.createElement('article');
  card.className='book-card '+(gallery?'gallery-card':'novel-card');
  card.dataset.cardOpen=b.id;card.dataset.bookId=b.id;
  const chapters=b.chapters||[];
  const images=b.gallery?.images||[];
  const pct=chapters.length?Math.min(100,Math.round((Number(b.progress?.chapter)||0)/chapters.length*100)):0;
  const characterCount=chapters.reduce((sum,ch)=>sum+String(ch.text||'').length,0);
  const rating=Number(b.rating)||0;
  const relationships=b.relationships||[];
  const relationBadge=relationships.length?'<div class="novel-link-badges">'+relationships.map(r=>'<span title="'+esc(r.type)+'">'+(r.type==='counterpart'?'↔':r.type==='sequel'?'→':'←')+'</span>').join('')+'</div>':'';
  const tags=(b.tags||[]).map(t=>'<span class="book-tag" style="--tag-color:'+tagColor(t,availableTags.indexOf(t))+'">#'+esc(t)+'</span>').join('');
  const sourceLabel=gallery?'GALLERY':b.source==='epub'?'EPUB':b.source==='pdf'?'PDF':b.source==='lnreader'?'LNREADER':'MY NOVEL';
  const coverSource=gallery?(b.cover||images[0]?.data):b.cover;
  const cover=coverSource?'<img loading="lazy" decoding="async" src="'+coverSource+'" alt="">':'<div class="cover-placeholder"><span>'+(gallery?'▧':'q.')+'</span><small>'+(gallery?'IMAGE COLLECTION':'QUIET READER')+'</small></div>';
  const stats=gallery?images.length+' images':chapters.length+' chapters';
  const detail=gallery?((b.author||'Personal collection')+' · '+stats):(b.author||'Unknown author')+' · '+stats+' · '+characterCount.toLocaleString()+' chars';
  const galleryProgress=gallery&&images.length?'<div class="gallery-cover-count">'+images.length+' IMAGES</div>':'';
  card.innerHTML='<div class="card-quick-actions"><button type="button" class="card-pin-action '+(b.pinned?'active':'')+'" data-card-toggle="pinned" data-book-id="'+b.id+'" aria-label="'+(b.pinned?'Unpin':'Pin')+' '+esc(b.title)+'" title="'+(b.pinned?'Unpin':'Pin')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-4 1-4 4v5l-2 2-2-7-7-2 2-2h5l4-4z"/></svg></button><button type="button" class="card-favorite-action '+(b.favorite?'active':'')+'" data-card-toggle="favorite" data-book-id="'+b.id+'" aria-label="'+(b.favorite?'Unlike':'Like')+' '+esc(b.title)+'" title="'+(b.favorite?'Unlike':'Like')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg></button></div><div class="book-cover '+(gallery?'gallery-cover':'novel-cover')+'">'+cover+galleryProgress+'</div>'+
   '<div class="book-info">'+
    '<div class="card-topline"><span class="library-type-badge '+(gallery?'gallery':'book')+'">'+sourceLabel+'</span><time class="card-updated">'+esc(updatedLabel(b.updated))+'</time></div>'+
    '<div class="book-title-row"><div class="book-title">'+esc(b.title||'Untitled')+'</div>'+(b.locked?'<span class="card-lock" title="Locked" aria-label="Locked"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>':'')+'</div>'+
    '<div class="book-subtitle">'+esc(detail)+'</div>'+
    (relationBadge||'')+(tags?'<div class="book-tags">'+tags+'</div>':'')+
    (gallery?'':'<div class="progress-row"><div class="progress-track"><span style="width:'+pct+'%"></span></div><span class="progress-label">'+(pct?pct+'%':'NEW')+'</span></div>')+
    '<div class="actions"><button class="card-open-action" data-open="'+b.id+'">'+(gallery?'Open gallery':'Open details')+'</button>'+
    '<button class="card-collection-action" data-add-to-collection="book" data-book-id="'+b.id+'" title="Add to collection">＋ Collection</button>'+
    ((chapters.length||gallery&&images.length)?'<button class="card-continue-action" data-continue="'+b.id+'">'+(gallery?'View images':'Continue reading')+'</button>':'')+
    '<button class="card-delete-action" data-delete="'+b.id+'" '+(b.locked?'disabled title="Unlock this entry before deleting it"':'')+' aria-label="Delete '+esc(b.title)+'" title="Delete entry"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button></div>'+
   '</div>';
  grid.append(card);
 }
 const listEl=$('pasteList');listEl.innerHTML='';
 if(!state.pastes.length)listEl.innerHTML='<div class="empty">No saved pasted chapters.</div>';
 for(const p of state.pastes){const row=document.createElement('div');row.className='chapter-row';row.innerHTML='<div class="chapter-name"><b>'+esc(p.title||'Untitled chapter')+'</b><div class="tiny muted">'+(p.text||'').length+' characters</div></div><button data-paste-open="'+p.id+'">Open</button><button data-paste-delete="'+p.id+'">×</button>';listEl.append(row)}
}
export function setLibrarySearch(query,mode){
 librarySearchQuery=String(query||'');
 librarySearchMode='everything';
 drawLibrary();
}
export function setLibraryView(view){const next=view==='compact'?'compact':'expanded';localStorage.setItem('qrLibraryView',next);$('bookGrid')?.classList.toggle('compact-view',next==='compact');document.querySelectorAll('[data-library-view]').forEach(button=>{button.classList.toggle('active',button.dataset.libraryView===next);button.setAttribute('aria-pressed',String(button.dataset.libraryView===next))})}
export function openBook(id){state.book=state.books.find(b=>b.id===id);if(!state.book)return;if(state.book.notesLocked===false){state.book.notesLocked=true;void put(state.book)}if(state.book.source==='gallery'){const now=Date.now();state.book.gallery=state.book.gallery||{images:[],view:'grid',history:[],createdAt:state.book.createdAt||state.book.updated||now};state.book.gallery.lastOpenedAt=now;state.book.gallery.history=(state.book.gallery.history||[]).concat({imageId:null,imageName:'Opened gallery',openedAt:now}).slice(-10);void put(state.book)}currentBookTab=state.book.source==='gallery'?'gallery':'chapters';drawBook();setScreen('book')}
function formatBookBytes(book){const size=data=>{if(!data)return 0;const comma=String(data).indexOf(',');return comma<0?0:Math.max(0,Math.floor((String(data).length-comma-1)*3/4)-(String(data).endsWith('==')?2:String(data).endsWith('=')?1:0))};const gallery=(book.gallery?.images||[]).reduce((n,image)=>n+(Number(image.size)||size(image.data)),0);const chapterImages=(book.chapters||[]).reduce((n,ch)=>n+(ch.images||[]).reduce((sum,image)=>sum+(Number(image.size)||size(image.data)),0),0);const text=(book.chapters||[]).reduce((n,ch)=>n+new TextEncoder().encode(String(ch.text||'')).length,0);const bytes=gallery+chapterImages+text;if(bytes<1024)return bytes+' B';if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';return (bytes/1048576).toFixed(2)+' MB'}
export function drawBook(){const b=state.book;if(!b)return;$('detailTitle').textContent=b.title;$('bookNotes').value=b.notes||'';$('bookNotes').disabled=Boolean(b.locked)||b.notesLocked!==false;$('noteLockToggle').disabled=Boolean(b.locked);$('noteLockToggle').innerHTML=(b.notesLocked===false? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg> Lock notes':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2"/></svg> Unlock notes');$('noteLockToggle').setAttribute('aria-pressed',String(b.notesLocked===false));$('notesSaveStatus').textContent=b.notesLocked===false?'Unlocked · saves automatically':'Saved · locked';setBookTab(currentBookTab);$('bookHistoryContent').innerHTML=novelHistoryMarkup(b);$('detailAuthor').textContent=b.author||'Unknown author';$('bookRating').value=String(Number(b.rating)||0);$('bookRating').disabled=Boolean(b.locked);$('detailCharacterCount').textContent=b.source==='gallery'?(b.gallery?.images?.length||0)+' images · '+formatBookBytes(b)+' total storage':(b.chapters||[]).reduce((sum,ch)=>sum+String(ch.text||'').length,0).toLocaleString()+' total characters · '+b.chapters.length+' chapters';const tagColors=(()=>{try{return JSON.parse(localStorage.getItem('qrTagColors')||'{}')}catch{return {}}})();$('detailTags').innerHTML=(Array.isArray(b.tags)?b.tags:[]).map((tag,i)=>'<span class="book-tag" style="--tag-color:'+(tagColors[tag]||defaultTagColors[i%defaultTagColors.length])+'">#'+esc(tag)+'</span>').join('');$('detailTags').classList.toggle('hidden',!(b.tags||[]).length);$('detailCover').innerHTML=b.cover?'<img src="'+b.cover+'" alt="">':'▤';$('lockLabel').innerHTML=(b.locked?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2"/></svg>')+' '+(b.source==='gallery'?(b.locked?'Gallery locked':'Gallery unlocked'):(b.locked?'Editing locked':'Editing enabled'));$('lockBook').innerHTML=(b.locked?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>')+' '+(b.source==='gallery'?(b.locked?'Unlock gallery':'Lock gallery'):(b.locked?'Unlock editing':'Lock editing'));$('addChapter').disabled=b.locked;$('addTxtChapter').disabled=b.locked;$('addTxtChapters').disabled=b.locked;$('renameChapters').disabled=b.locked;$('addGalleryImages').disabled=b.locked;$('addGalleryFolder').disabled=b.locked;$('editDetails').disabled=b.locked;$('editTags').disabled=b.locked;$('changeCover').disabled=b.locked;$('pasteCover').disabled=b.locked;$('manageNovelLinks').disabled=Boolean(b.locked);$('manageNovelLinks').setAttribute('aria-disabled',String(Boolean(b.locked)));$('exportEpub').disabled=!b.chapters?.length;const el=$('chapterList');el.innerHTML='';if(!b.chapters.length)el.innerHTML='<div class="empty">No chapters yet. Add your first chapter.</div>';b.chapters.forEach((c,i)=>{const row=document.createElement('div');row.className='chapter-row chapter-index-row';const bookmarked=(b.bookmarks||[]).some(mark=>Number(mark.chapter)===i);const added=dateTime(c.createdAt??c.addedAt);row.innerHTML='<div class="chapter-name" data-read="'+i+'"><b>'+esc(c.title||'Chapter '+(i+1))+'</b><div class="tiny muted">'+(c.text||'').length+' characters</div><div class="chapter-added-date"><span>Added</span><time>'+esc(added)+'</time></div></div>'+'<button data-add-to-collection="chapter" data-book-id="'+b.id+'" data-chapter-index="'+i+'" title="Add chapter to collection">＋</button>'+'<button data-manage-chapter-links="'+i+'" class="chapter-link-edit" title="Manage linked chapters" '+(b.locked?'disabled aria-disabled="true"':'')+'>↔</button>'+(bookmarked?'<span class="chapter-bookmark-indicator" title="Bookmarked chapter" aria-label="Bookmarked chapter">★</span>':'')+'<button data-history="'+i+'">History</button><button data-chapter-move="'+i+'" data-delta="-1" '+(b.locked||i===0?'disabled':'')+' aria-label="Move chapter up">↑</button><button data-chapter-move="'+i+'" data-delta="1" '+(b.locked||i===b.chapters.length-1?'disabled':'')+' aria-label="Move chapter down">↓</button><button data-edit="'+i+'" '+(b.locked?'disabled':'')+'>Edit</button><button data-read-button="'+i+'">Read</button>';el.append(row)})}

export function showChapterHistory(index){
 const chapter=state.book?.chapters?.[index];if(!chapter)return;
 const entries=[{label:'Added',time:chapter.createdAt??chapter.addedAt,title:chapter.title,text:chapter.text},...(Array.isArray(chapter.history)?chapter.history:[]).map((item,i)=>({label:'Edited · version '+(i+1),time:item.editedAt,title:item.title,text:item.text})),{label:'Current version',time:chapter.updatedAt??null,title:chapter.title,text:chapter.text,current:true}];
 const body=entries.map(item=>'<section class="chapter-history-entry '+(item.current?'current':'')+'"><div class="chapter-history-heading"><b>'+esc(item.label)+'</b><time>'+esc(dateTime(item.time))+'</time></div><div class="tiny muted">'+esc(item.title||'Untitled chapter')+'</div><p>'+esc(String(item.text||'').slice(0,420))+(String(item.text||'').length>420?'…':'')+'</p></section>').join('');
 modal('Chapter edit history · '+(chapter.title||'Chapter '+(index+1)),body);
}
export function setBookTab(tab){
 currentBookTab=['notes','history','gallery'].includes(tab)?tab:'chapters';
 $('bookChaptersTab')?.classList.toggle('hidden',currentBookTab!=='chapters');
 $('bookNotesTab')?.classList.toggle('hidden',currentBookTab!=='notes');
 $('bookHistoryTab')?.classList.toggle('hidden',currentBookTab!=='history');
 $('bookGalleryTab')?.classList.toggle('hidden',currentBookTab!=='gallery');
 $('bookTabs')?.querySelectorAll('[data-book-tab]').forEach(button=>button.classList.toggle('active',button.dataset.bookTab===currentBookTab));
}
export async function saveBookNotes(options={}){
 if(!state.book)return;
 const {lock=false,silent=false}=options;
 if(lock)clearTimeout(window.__qrNotesSaveTimer);
 const nextNotes=$('bookNotes').value,changed=state.book.notes!==nextNotes;
 state.book.notes=nextNotes;
 if(lock)state.book.notesLocked=true;else state.book.notesLocked=false;
 if(changed){state.book.updated=Date.now();addEditEvent(state.book,'Novel notes edited','Notes updated')}
 await put(state.book);
 if($('bookNotes'))$('bookNotes').disabled=Boolean(state.book.locked)||Boolean(state.book.notesLocked);
 if($('noteLockToggle')){$('noteLockToggle').innerHTML=(state.book.notesLocked? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2"/></svg> Unlock notes':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg> Lock notes');$('noteLockToggle').setAttribute('aria-pressed',String(!state.book.notesLocked))}
 if($('notesSaveStatus'))$('notesSaveStatus').textContent=state.book.notesLocked?'Saved · locked':'Saved automatically';
 if(!silent)toast(state.book.notesLocked?'Notes saved and locked':'Notes saved');
}
export function createNovel(){modal('Create a novel','<div class="stack"><label>Title<input id="newTitle" placeholder="Novel title"></label><label>Author (optional)<input id="newAuthor"></label><label>Tags (comma-separated)<input id="newTags" placeholder="cultivation, xianxia, fantasy"></label><button id="createNow" class="primary">Create novel</button></div>',()=>{$('createNow').onclick=async()=>{const b=freshBook('manual',$('newTitle').value.trim()||'Untitled novel');b.author=$('newAuthor').value.trim();b.tags=[...new Set($('newTags').value.split(',').map(t=>t.trim().replace(/^#/,'' )).filter(Boolean))];await put(b);await refresh();openBook(b.id);$('modalHost').innerHTML=''}})}
export async function handleLibraryClick(e){const toggle=e.target.closest('[data-card-toggle]');if(toggle){const book=state.books.find(item=>item.id===toggle.dataset.bookId);if(!book)return;const key=toggle.dataset.cardToggle;book[key]=!book[key];book.updated=Date.now();await put(book);await refresh();drawLibrary();toast(key==='pinned'?'Pin updated':'Like updated');return}const btn=e.target.closest('button');if(!btn){const card=e.target.closest('[data-card-open]');if(card)openBook(card.dataset.cardOpen);return}const id=btn.dataset.open||btn.dataset.continue||btn.dataset.delete;if(id){const b=state.books.find(x=>x.id===id);if(btn.dataset.delete!==undefined){if(b.locked){toast('Unlock this novel before deleting it');return}modal('Delete this entry?','<div class="stack"><p>Are you sure you want to permanently delete <strong>'+esc(b.title||'this entry')+'</strong> and its local data?</p><div class="row"><span class="grow"></span><button type="button" id="cancelDeleteEntry">Cancel</button><button type="button" id="confirmDeleteEntry" class="danger">Delete</button></div></div>',()=>{$('cancelDeleteEntry').onclick=closeModal;$('confirmDeleteEntry').onclick=async()=>{await remove(id);await refresh();closeModal();toast('Entry deleted')}})}else{state.book=b;if(b.source==='gallery'){const now=Date.now();b.gallery=b.gallery||{images:[],view:'grid',history:[],createdAt:b.createdAt||b.updated||now};b.gallery.lastOpenedAt=now;b.gallery.history=(b.gallery.history||[]).concat({imageId:null,imageName:'Opened gallery',openedAt:now}).slice(-10);void put(b)}currentBookTab=b.source==='gallery'?'gallery':'chapters';drawBook();if(btn.dataset.continue!==undefined)openReader(b.progress?.chapter||0);else setScreen('book')}return}const pid=btn.dataset.pasteOpen||btn.dataset.pasteDelete;if(pid){const p=state.pastes.find(x=>x.id===pid);if(btn.dataset.pasteDelete!==undefined){modal('Delete saved chapter?','<div class="stack"><p>Are you sure you want to permanently delete <strong>'+esc(p.title||'this chapter')+'</strong>?</p><div class="row"><span class="grow"></span><button type="button" id="cancelDeletePaste">Cancel</button><button type="button" id="confirmDeletePaste" class="danger">Delete</button></div></div>',()=>{$('cancelDeletePaste').onclick=closeModal;$('confirmDeletePaste').onclick=async()=>{await remove(pid);await refresh();closeModal();toast('Saved chapter deleted')}})}else{$('pasteTitle').value=p.title||'';$('pasteText').value=p.text||'';setScreen('paste')}}}
export async function savePasteAsBook(read=false){const text=$('pasteText').value.trim(),title=$('pasteTitle').value.trim();if(!text)return toast('Paste chapter text first');const b=freshBook('manual',title||'Pasted chapter');const now=Date.now();b.chapters=[{title:title||'Chapter 1',text,images:[],createdAt:now,updatedAt:now,history:[]}];await put(b);await refresh();state.book=b;if(read)openReader(0);else{openBook(b.id);toast('Saved to library')}}
export async function savePasteOnly(){const text=$('pasteText').value.trim(),title=$('pasteTitle').value.trim();if(!text)return toast('Paste chapter text first');await put({id:Date.now().toString(36)+Math.random().toString(36).slice(2),kind:'paste',title,text,updated:Date.now()});await refresh();toast('Pasted chapter saved')}