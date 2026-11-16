import {state,freshBook} from './state.js';
import {put} from './db.js';
import {$,esc,toast,modal,closeModal,dataURL,uid} from './utils.js';
import {refresh,openBook,setBookTab,drawBook} from './library.js';import {addEditEvent} from './history.js';import {confirmImagePreview} from './image-preview.js';
import {openImageTranslation,renderImageTranslationOverlay,clearImageTranslationOverlay} from './image-translation.js';

let sliderIndex=0;
let viewerKeyHandler=null;let selectedImageIds=new Set();
const imageFiles=files=>[...files].filter(file=>file.type?.startsWith('image/')||/\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(file.name)).sort((a,b)=>new Intl.Collator(undefined,{numeric:true,sensitivity:'base'}).compare(a.webkitRelativePath||a.name,b.webkitRelativePath||b.name));
const dateTime=value=>Number.isFinite(Number(value))&&Number(value)>0?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(Number(value))):'Not opened yet';
function ensureGallery(book){
 book.gallery=book.gallery||{images:[],view:'grid',history:[],createdAt:Date.now(),lastOpenedAt:null};
 book.gallery.images=book.gallery.images||[];
 book.gallery.history=book.gallery.history||[];if(!book.gallery.createdAt)book.gallery.createdAt=book.createdAt||book.updated||Date.now();
 for(const image of book.gallery.images){if(!image.id)image.id=uid();if(!image.addedAt)image.addedAt=book.createdAt||book.updated||Date.now();if(!Array.isArray(image.history))image.history=[]}
 return book.gallery;
}
async function persist(book){book.updated=Date.now();await put(book);const index=state.books.findIndex(item=>item.id===book.id);if(index>=0)state.books[index]=book}
export function createGallery(){
 let selectedFiles=[];
 const body='<div class="stack"><label>Gallery title<input id="newGalleryTitle" placeholder="Gallery title"></label><label>Author / source (optional)<input id="newGalleryAuthor"></label><label>Tags (comma-separated)<input id="newGalleryTags" placeholder="art, reference, characters"></label><p class="muted tiny">Choose images or a folder. GIFs remain animated. You can also create an empty gallery and add images later.</p><div class="row wrap"><button type="button" id="selectGalleryImages">Choose images</button><button type="button" id="selectGalleryFolder">Choose folder</button><span id="gallerySelectionCount" class="tiny muted">No images selected</span></div><input id="newGalleryImageFiles" type="file" accept="image/*" multiple hidden><input id="newGalleryFolderFiles" type="file" accept="image/*" webkitdirectory directory multiple hidden><button id="createGalleryNow" class="primary">Create gallery</button></div>';
 modal('Create an image gallery',body,()=>{
  $('selectGalleryImages').onclick=()=>$('newGalleryImageFiles').click();
  $('selectGalleryFolder').onclick=()=>$('newGalleryFolderFiles').click();
  const updateSelection=files=>{selectedFiles=imageFiles(files);$('gallerySelectionCount').textContent=selectedFiles.length+' image'+(selectedFiles.length===1?'':'s')+' selected'};
  $('newGalleryImageFiles').onchange=e=>updateSelection(e.target.files);
  $('newGalleryFolderFiles').onchange=e=>updateSelection(e.target.files);
  $('createGalleryNow').onclick=async()=>{
   const book=freshBook('gallery',$('newGalleryTitle').value.trim()||'Untitled gallery');
   book.author=$('newGalleryAuthor').value.trim();
   book.tags=[...new Set($('newGalleryTags').value.split(',').map(tag=>tag.trim().replace(/^#/,'')).filter(Boolean))];
   book.gallery={images:[],view:'grid',history:[],createdAt:Date.now(),lastOpenedAt:null};
   for(const file of selectedFiles){try{book.gallery.images.push({id:uid(),name:(file.webkitRelativePath||file.name).split('/').pop(),data:await dataURL(file),mime:file.type||'application/octet-stream',size:file.size,addedAt:Date.now(),lastOpenedAt:null,notes:'',locked:false,history:[]})}catch(error){console.warn('Could not import gallery image',file.name,error)}}
   if(book.gallery.images[0])book.cover=book.gallery.images[0].data;
   addEditEvent(book,'Gallery created',book.gallery.images.length+' images');await put(book);await refresh();closeModal();openBook(book.id);setBookTab('gallery');renderGallery();toast('Gallery created · '+book.gallery.images.length+' images');
  };
 });
}
export function addGalleryImages(){if(!state.book||state.book.locked)return toast('Unlock editing first');$('galleryImageFiles')?.click()}
export function addGalleryFolder(){if(!state.book||state.book.locked)return toast('Unlock editing first');$('galleryFolderFiles')?.click()}
export async function importGalleryFiles(fileList){
 const book=state.book;if(!book||book.locked)return toast('Unlock editing first');
 const files=imageFiles(fileList||[]);if(!files.length)return toast('No supported images found');
 if(!(await confirmImagePreview(files,{title:'Preview gallery images',confirmLabel:'Add to gallery'})))return;
 const gallery=ensureGallery(book);let added=0;
 for(const file of files){try{gallery.images.push({id:uid(),name:(file.webkitRelativePath||file.name).split('/').pop(),data:await dataURL(file),mime:file.type||'application/octet-stream',size:file.size,addedAt:Date.now(),lastOpenedAt:null,notes:'',locked:false,history:[]});added++}catch(error){console.warn('Could not import gallery image',file.name,error)}}
 if(!book.cover&&gallery.images[0])book.cover=gallery.images[0].data;
 addEditEvent(book,'Gallery images added',added+' images');await persist(book);await refresh();drawBook();setBookTab('gallery');renderGallery();
 toast(added+' image'+(added===1?'':'s')+' added'+(added<files.length?' · '+(files.length-added)+' failed':''));
}
async function copyImage(image){
 if(!image)return;
 try{const response=await fetch(image.data),blob=await response.blob();if(navigator.clipboard?.write&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({[blob.type||'image/png']:blob})]);toast('Image copied');return}}catch(error){}
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(image.data);toast('Image data URL copied · image clipboard unavailable')}else toast('Image clipboard is unavailable in this browser')}catch(error){toast('Could not copy image in this browser')}
}
async function openImage(index){
 const book=state.book,gallery=ensureGallery(book),image=gallery.images[index];if(!image)return;
 // Browser fullscreen is best-effort; continue if the browser declines it.
 if(!document.fullscreenElement&&document.documentElement.requestFullscreen){try{const request=document.documentElement.requestFullscreen();request?.catch?.(()=>{})}catch(error){}}
 const now=Date.now();image.lastOpenedAt=now;gallery.lastOpenedAt=now;
 image.history=(image.history||[]).concat({openedAt:now}).slice(-10);
 gallery.history=gallery.history.concat({imageId:image.id,imageName:image.name||'Image',openedAt:now}).slice(-10);
 sliderIndex=index;await persist(book);renderGallery();showImageViewer(index);
}
function showImageViewer(index){
 const book=state.book,gallery=ensureGallery(book),images=gallery.images;
 if(!images.length)return;
 sliderIndex=Math.max(0,Math.min(images.length-1,index));
 let viewerZoom=1,panX=0,panY=0,dragState=null;
 const body='<div class="image-viewer"><div class="image-viewer-stage" id="imageViewerStage"></div><div id="imageTranslationPanel" class="image-translation-panel" hidden></div><button type="button" class="image-translate-trigger" data-image-translate title="Translate image text">文　Translate image</button><button type="button" class="image-viewer-thumbnails-toggle" data-viewer-thumbnails>Hide thumbnails</button><div class="image-viewer-filmstrip" id="imageViewerFilmstrip"></div><div class="image-viewer-meta" id="imageViewerMeta"></div><details class="image-viewer-details" id="imageViewerDetails"><summary>Image notes & details</summary><div id="imageViewerDetailContent"></div></details></div>';
 const applyImageTransform=()=>{
  const image=$('imageViewerImage');if(!image)return;
  image.style.transform='translate3d('+panX+'px,'+panY+'px,0) scale('+viewerZoom+')';
  const label=document.querySelector('.image-viewer-zoom-label');if(label)label.textContent='Zoom: '+Math.round(viewerZoom*100)+'%';
  renderImageTranslationOverlay(images[sliderIndex],{panX,panY,viewerZoom});
 };
 const updateViewer=(direction=0)=>{
  const current=images[sliderIndex],prev=images[sliderIndex-1],next=images[sliderIndex+1],stage=$('imageViewerStage');if(!stage)return;
  stage.innerHTML='<figure class="image-viewer-current"><div class="image-viewer-image-wrap" id="imageViewerImageWrap"><img id="imageViewerImage" class="viewer-image-enter" src="'+current.data+'" alt="'+esc(current.name||'Gallery image')+'" draggable="false"></div><span class="image-viewer-count">'+(sliderIndex+1)+' of '+images.length+'</span><figcaption><b>'+esc(current.name||'Image '+(sliderIndex+1))+'</b></figcaption></figure>'+(prev?'<button type="button" class="image-viewer-arrow previous" data-viewer-prev aria-label="Previous image">‹</button>':'')+(next?'<button type="button" class="image-viewer-arrow next" data-viewer-next aria-label="Next image">›</button>':'')+'<div class="image-viewer-zoom-controls"><button type="button" data-viewer-zoom="out" aria-label="Zoom out">−</button><button type="button" data-viewer-zoom="fit" aria-label="Fit image">Fit</button><button type="button" data-viewer-zoom="in" aria-label="Zoom in">+</button></div>';
  const strip=$('imageViewerFilmstrip');strip.innerHTML=images.map((item,i)=>'<button type="button" data-viewer-index="'+i+'" class="'+(i===sliderIndex?'active':'')+'" aria-label="Show image '+(i+1)+'" aria-current="'+(i===sliderIndex?'true':'false')+'"><img loading="lazy" decoding="async" src="'+item.data+'" alt=""></button>').join('');
  $('imageViewerMeta').innerHTML='<span>Added: '+esc(dateTime(current.addedAt))+'</span><span>Last opened: '+esc(dateTime(current.lastOpenedAt))+'</span><span>'+(current.locked?'🔒 Image locked':'🔓 Image unlocked')+'</span><span class="image-viewer-zoom-label">Zoom: '+Math.round(viewerZoom*100)+'%</span>';
  $('imageViewerDetailContent').innerHTML='<label>Notes<textarea id="galleryImageNotes" rows="3" '+(book.locked||current.locked?'disabled':'')+'>'+esc(current.notes||'')+'</textarea></label><div class="image-individual-history"><b>Image viewing history · Last 10</b>'+(current.history?.length?current.history.slice(-10).reverse().map(entry=>'<span>'+esc(dateTime(entry.openedAt))+'</span>').join(''):'<span class="muted">No previous views</span>')+'</div><div class="row wrap"><button type="button" id="saveGalleryImageNote" '+(book.locked||current.locked?'disabled':'')+'>Save note</button><span class="grow"></span><button type="button" id="copyViewerImage">Copy image</button><button type="button" id="toggleImageLock" '+(book.locked?'disabled':'')+'>'+(current.locked?'Unlock image':'Lock image')+'</button><button type="button" id="deleteViewerImage" class="danger" '+(book.locked||current.locked?'disabled':'')+'>Delete image</button></div>';
  applyImageTransform();strip.querySelector('[data-viewer-index="'+sliderIndex+'"]')?.scrollIntoView({block:'nearest',inline:'center'});
 };
 const setViewerIndex=async(nextIndex,direction=0)=>{
  const next=Math.max(0,Math.min(images.length-1,nextIndex));if(next===sliderIndex)return;
  sliderIndex=next;viewerZoom=1;panX=0;panY=0;
  const current=images[sliderIndex],now=Date.now();current.lastOpenedAt=now;gallery.lastOpenedAt=now;
  current.history=(current.history||[]).concat({openedAt:now}).slice(-10);gallery.history=(gallery.history||[]).concat({imageId:current.id,imageName:current.name||'Image',openedAt:now}).slice(-10);
  await persist(book);renderGallery();updateViewer(direction);
 };
 modal('Gallery viewer',body,()=>{
  document.querySelector('#modalHost .modal')?.classList.add('image-viewer-modal');document.querySelector('#modalBack')?.classList.add('image-viewer-backdrop');updateViewer();
  const host=$('modalHost');
  host.onclick=async event=>{
   if(event.target.closest('[data-viewer-prev]')){await setViewerIndex(sliderIndex-1,-1);return}
   if(event.target.closest('[data-viewer-next]')){await setViewerIndex(sliderIndex+1,1);return}
   if(event.target.closest('[data-image-translate]')){await openImageTranslation(images[sliderIndex]);return}
   const zoomButton=event.target.closest('[data-viewer-zoom]');if(zoomButton){const action=zoomButton.dataset.viewerZoom;viewerZoom=action==='fit'?1:Math.max(1,Math.min(8,viewerZoom*(action==='in'?1.5:1/1.5)));if(viewerZoom===1){panX=0;panY=0}applyImageTransform();return}
   const thumbToggle=event.target.closest('[data-viewer-thumbnails]');if(thumbToggle){const strip=$('imageViewerFilmstrip'),hidden=strip.hidden;strip.hidden=!hidden;thumbToggle.textContent=hidden?'Hide thumbnails':'Show thumbnails';return}
   const thumb=event.target.closest('[data-viewer-index]');if(thumb){await setViewerIndex(Number(thumb.dataset.viewerIndex),Number(thumb.dataset.viewerIndex)>sliderIndex?1:-1);return}
   const current=images[sliderIndex];
   if(event.target.closest('#copyViewerImage')){await copyImage(current);return}
   if(event.target.closest('#saveGalleryImageNote')){current.notes=$('galleryImageNotes').value;await persist(book);toast('Image note saved');return}
   if(event.target.closest('#toggleImageLock')){current.locked=!current.locked;await persist(book);updateViewer();renderGallery();toast(current.locked?'Image locked':'Image unlocked');return}
   if(event.target.closest('#deleteViewerImage')){if(current.locked||book.locked)return toast('Unlock this image and gallery before deleting');if(!confirm('Delete this image from the gallery?'))return;images.splice(sliderIndex,1);addEditEvent(book,'Gallery image deleted',current.name||'Image');await persist(book);if(!images.length){if(viewerKeyHandler)document.removeEventListener('keydown',viewerKeyHandler);viewerKeyHandler=null;closeModal();renderGallery();toast('Image deleted');return}sliderIndex=Math.min(sliderIndex,images.length-1);viewerZoom=1;panX=0;panY=0;await setViewerIndexAfterDelete()}
  };
  const setViewerIndexAfterDelete=async()=>{const current=images[sliderIndex],now=Date.now();current.lastOpenedAt=now;gallery.lastOpenedAt=now;current.history=(current.history||[]).concat({openedAt:now}).slice(-10);gallery.history=(gallery.history||[]).concat({imageId:current.id,imageName:current.name||'Image',openedAt:now}).slice(-10);await persist(book);renderGallery();updateViewer()};
  if(viewerKeyHandler)document.removeEventListener('keydown',viewerKeyHandler);
  viewerKeyHandler=event=>{if(event.key==='ArrowLeft'){event.preventDefault();setViewerIndex(sliderIndex-1,-1)}else if(event.key==='ArrowRight'){event.preventDefault();setViewerIndex(sliderIndex+1,1)}else if(event.key==='Escape'){if(viewerKeyHandler)document.removeEventListener('keydown',viewerKeyHandler);viewerKeyHandler=null;clearImageTranslationOverlay();closeModal();if(document.fullscreenElement)document.exitFullscreen?.().catch?.(()=>{})}};
  document.addEventListener('keydown',viewerKeyHandler);
  const stage=$('imageViewerStage');
  const wrap=$('imageViewerImageWrap');
  wrap?.addEventListener('wheel',event=>{
   event.preventDefault();const old=viewerZoom,next=Math.max(1,Math.min(5,old*Math.exp(-event.deltaY*0.002)));
   const rect=wrap.getBoundingClientRect(),px=event.clientX-(rect.left+rect.width/2),py=event.clientY-(rect.top+rect.height/2),ratio=next/old;
   panX=px-(px-panX)*ratio;panY=py-(py-panY)*ratio;viewerZoom=next;
   if(viewerZoom===1){panX=0;panY=0}applyImageTransform();
  },{passive:false});
  const activePointers=new Map();let pinchStart=0,pinchZoom=1,lastTap=0;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  wrap?.addEventListener('pointerdown',event=>{
   if(event.pointerType==='mouse'&&event.button!==0)return;
   wrap.setPointerCapture?.(event.pointerId);activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY});
   if(activePointers.size===2){const p=[...activePointers.values()];pinchStart=distance(p[0],p[1]);pinchZoom=viewerZoom;dragState=null}
   else if(activePointers.size===1){dragState={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false,zoom:viewerZoom}}
  });
  wrap?.addEventListener('pointermove',event=>{
   if(!activePointers.has(event.pointerId))return;
   activePointers.set(event.pointerId,{...activePointers.get(event.pointerId),x:event.clientX,y:event.clientY});
   if(activePointers.size===2){const p=[...activePointers.values()],d=distance(p[0],p[1]);if(pinchStart>0){viewerZoom=Math.max(1,Math.min(5,pinchZoom*d/pinchStart));if(viewerZoom===1){panX=0;panY=0}applyImageTransform()}return}
   if(!dragState)return;
   if(Math.abs(event.clientX-dragState.x)>5||Math.abs(event.clientY-dragState.y)>5)dragState.moved=true;
   if(viewerZoom>1){panX+=event.clientX-dragState.lastX;panY+=event.clientY-dragState.lastY;dragState.lastX=event.clientX;dragState.lastY=event.clientY;applyImageTransform()}
  });
  const finishPointer=event=>{
   const point=activePointers.get(event.pointerId);activePointers.delete(event.pointerId);
   if(activePointers.size<2)pinchStart=0;
   if(!dragState)return;
   const dx=event.clientX-dragState.x,dy=event.clientY-dragState.y,wasZoomed=dragState.zoom>1,moved=dragState.moved;dragState=null;
   if(!wasZoomed&&viewerZoom===1&&moved&&Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.25)setViewerIndex(sliderIndex+(dx<0?1:-1),dx<0?1:-1);
   else if(!moved&&event.pointerType!=='mouse'){const now=Date.now();if(now-lastTap<280){viewerZoom=viewerZoom>1?1:2.5;if(viewerZoom===1){panX=0;panY=0}applyImageTransform()}lastTap=now}
   if(activePointers.size===1){const p=[...activePointers.values()][0];dragState={x:p.x,y:p.y,lastX:p.x,lastY:p.y,moved:false,zoom:viewerZoom}}
  };
  wrap?.addEventListener('pointerup',finishPointer);wrap?.addEventListener('pointercancel',event=>{activePointers.delete(event.pointerId);dragState=null;pinchStart=0});
  $('modalClose').addEventListener('click',()=>{clearImageTranslationOverlay();if(viewerKeyHandler)document.removeEventListener('keydown',viewerKeyHandler);viewerKeyHandler=null;if(document.fullscreenElement)document.exitFullscreen?.().catch?.(()=>{})},{once:true});
 });
}
function showGalleryHistory(){
 const history=[...(state.book?.gallery?.history||[])].slice(-10).reverse();
 const body=history.length?'<div class="reading-history-list">'+history.map(item=>'<div class="reading-history-entry"><span class="reading-history-copy"><b>'+esc(item.imageName||'Image')+'</b><small>'+esc(dateTime(item.openedAt))+'</small></span><button type="button" class="gallery-history-open" data-open-gallery-history="'+esc(item.imageId||'')+'">Open</button></div>').join('')+'</div>':'<div class="empty">No gallery viewing history yet.</div>';
 modal('Gallery history · Last 10',body,()=>{
  document.querySelector('#modalHost .modal')?.classList.add('gallery-history-modal');
  $('modalHost').onclick=async event=>{
   const open=event.target.closest('[data-open-gallery-history]');if(!open)return;
   const imageIndex=(state.book?.gallery?.images||[]).findIndex(image=>image.id===open.dataset.openGalleryHistory);
   if(imageIndex<0){toast('This image is no longer in the gallery');return}
   closeModal();await openImage(imageIndex);
  };
 });
}

function formatBytes(value){const bytes=Math.max(0,Number(value)||0);if(bytes<1024)return bytes+' B';const units=['KB','MB','GB'];let size=bytes/1024,index=0;while(size>=1024&&index<units.length-1){size/=1024;index++}return size.toFixed(size>=10?1:2)+' '+units[index]}
function dataSize(data){if(!data)return 0;const comma=data.indexOf(',');return comma<0?0:Math.max(0,Math.floor((data.length-comma-1)*3/4)-(data.endsWith('==')?2:data.endsWith('=')?1:0))}
function imageSize(image){return Number(image.size)||dataSize(image.data)}
function bookStorage(book){
 const gallery=(book.gallery?.images||[]).reduce((n,image)=>n+imageSize(image),0);
 const chapterImages=(book.chapters||[]).reduce((n,ch)=>n+(ch.images||[]).reduce((sum,image)=>sum+(Number(image.size)||dataSize(image.data)),0),0);
 const chapterText=(book.chapters||[]).reduce((n,ch)=>n+new TextEncoder().encode(String(ch.text||'')).length,0);
 return{gallery,chapterImages,chapterText,total:gallery+chapterImages+chapterText};
}
function renameImage(image,name){
 const old=String(image.name||'image'),dot=old.lastIndexOf('.'),ext=dot>0?old.slice(dot):'';
 let base=String(name||'').trim().replace(/[\\/:*?"<>|]/g,'_');
 if(!base)return false;
 if(ext&&base.toLowerCase().endsWith(ext.toLowerCase()))base=base.slice(0,-ext.length);
 image.name=base+ext;return true;
}
export async function pasteGalleryImages(){
 const book=state.book;if(!book||book.locked)return toast('Unlock editing first');
 if(!navigator.clipboard?.read)return toast('Clipboard image access is unavailable in this browser');
 try{const items=await navigator.clipboard.read();const files=[];for(const item of items){const type=item.types.find(value=>value.startsWith('image/'));if(type){const blob=await item.getType(type);files.push(new File([blob],'pasted-image-'+(files.length+1)+'.'+(type.split('/')[1]||'png'),{type}))}}
 if(!files.length)return toast('No image found in clipboard');
 await importGalleryFiles(files);
 }catch(error){toast('Could not read clipboard image. Check browser clipboard permission.')}
}
export async function continueGallery(book=state.book){
 if(!book||book.source!=='gallery')return;
 state.book=book;ensureGallery(book);
 const history=[...(book.gallery.history||[])].reverse();
 let index=-1;
 for(const entry of history){index=book.gallery.images.findIndex(image=>image.id===entry.imageId);if(index>=0)break}
 if(index<0){const image=book.gallery.images.reduce((best,item,i)=>!best||Number(item.lastOpenedAt||0)>Number(book.gallery.images[best.index].lastOpenedAt||0)?{index:i}:best,null);index=image?.index??-1}
 if(index>=0){await openImage(index);return}
 openBook(book.id);setBookTab('gallery');renderGallery();
}
function bulkRenameImages(book,images){
 if(book.locked)return toast('Unlock this gallery first');
 const selected=images.filter(image=>selectedImageIds.has(image.id)&&!image.locked);
 if(!selected.length)return toast('Select at least one unlocked image');
 const body='<div class="stack"><p class="muted tiny">The original file extension is preserved for every image. Numbering follows the current gallery order.</p><label>Name prefix<input id="galleryRenamePrefix" value="Image_" placeholder="e.g. Character_"></label><div class="row"><label class="grow">Starting number<input id="galleryRenameStart" type="number" min="0" step="1" value="1"></label><label class="grow">Digits<input id="galleryRenameDigits" type="number" min="1" max="8" value="3"></label></div><div id="galleryRenamePreview" class="rename-preview"></div><div class="row"><span class="grow"></span><button type="button" id="applyGalleryBulkRename" class="primary">Rename '+selected.length+' images</button></div></div>';
 modal('Bulk rename images',body,()=>{
  const preview=()=>{const prefix=$('galleryRenamePrefix').value||'Image_',start=Math.max(0,Number($('galleryRenameStart').value)||0),digits=Math.max(1,Math.min(8,Number($('galleryRenameDigits').value)||1));$('galleryRenamePreview').innerHTML=selected.slice(0,8).map((image,i)=>{const dot=image.name.lastIndexOf('.'),ext=dot>0?image.name.slice(dot):'';return '<div class="rename-preview-row"><span>'+esc(image.name)+'</span><span>→</span><b>'+esc(prefix+String(start+i).padStart(digits,'0')+ext)+'</b></div>'}).join('')+(selected.length>8?'<p class="muted tiny">and '+(selected.length-8)+' more…</p>':'')};
  ['galleryRenamePrefix','galleryRenameStart','galleryRenameDigits'].forEach(id=>$(id).addEventListener('input',preview));preview();
  $('applyGalleryBulkRename').onclick=async()=>{const prefix=$('galleryRenamePrefix').value.trim()||'Image_',start=Math.max(0,Number($('galleryRenameStart').value)||0),digits=Math.max(1,Math.min(8,Number($('galleryRenameDigits').value)||1));let number=0;for(const image of selected){const dot=image.name.lastIndexOf('.'),ext=dot>0?image.name.slice(dot):'';image.name=prefix+String(start+number++).padStart(digits,'0')+ext}addEditEvent(book,'Images bulk renamed',selected.length+' images');await persist(book);selectedImageIds.clear();closeModal();renderGallery();drawBook();toast(selected.length+' images renamed')};
 });
}
export function renderGallery(){
 const book=state.book,host=$('galleryContent');if(!host||!book)return;
 const gallery=ensureGallery(book),images=gallery.images,view=['slider','compact'].includes(gallery.view)?gallery.view:'grid';
 const sizes=bookStorage(book);
 host.innerHTML='<div class="gallery-overview tiny muted">Gallery added '+esc(dateTime(gallery.createdAt))+' · Last opened '+esc(dateTime(gallery.lastOpenedAt))+'<br>Gallery images '+formatBytes(sizes.gallery)+' · Chapter images '+formatBytes(sizes.chapterImages)+' · Chapter text '+formatBytes(sizes.chapterText)+' · <b>Total '+formatBytes(sizes.total)+'</b></div><div class="gallery-toolbar"><div class="row wrap"><button type="button" data-gallery-view="grid" class="'+(view==='grid'?'active':'')+'">▦ Grid</button><button type="button" data-gallery-view="compact" class="'+(view==='compact'?'active':'')+'">☷ Compact</button><button type="button" data-gallery-view="slider" class="'+(view==='slider'?'active':'')+'">▣ Slideshow</button><span class="muted tiny">'+images.length+' images · '+formatBytes(sizes.gallery)+'</span><button type="button" data-gallery-history>◷ History</button><span class="grow"></span><button type="button" data-gallery-add '+(book.locked?'disabled':'')+'>＋ Add images</button><button type="button" data-gallery-folder '+(book.locked?'disabled':'')+'>＋ Add folder</button><button type="button" data-gallery-paste '+(book.locked?'disabled':'')+'>Paste image</button></div></div><div class="gallery-lock-note">'+(book.locked?'🔒 This gallery is locked. Unlock editing to change images or notes.':'Gallery unlocked · locked images cannot be renamed or reordered')+'</div>';
 host.onclick=async event=>{
  const viewButton=event.target.closest('[data-gallery-view]');if(viewButton){gallery.view=viewButton.dataset.galleryView;await persist(book);renderGallery();return}
  if(event.target.closest('[data-gallery-add]')){addGalleryImages();return}
  if(event.target.closest('[data-gallery-folder]')){addGalleryFolder();return}
  if(event.target.closest('[data-gallery-paste]')){await pasteGalleryImages();return}
  if(event.target.closest('[data-gallery-history]')){showGalleryHistory();return}
  if(event.target.closest('[data-gallery-select-all]')){const unlocked=images.filter(image=>!image.locked);if(selectedImageIds.size===unlocked.length)selectedImageIds.clear();else unlocked.forEach(image=>selectedImageIds.add(image.id));renderGallery();return}
  if(event.target.closest('[data-gallery-clear-selection]')){selectedImageIds.clear();renderGallery();return}
  if(event.target.closest('[data-gallery-bulk-rename]')){bulkRenameImages(book,images);return}
  const rename=event.target.closest('[data-image-rename]');if(rename){const image=images[Number(rename.dataset.imageRename)];if(!image||book.locked||image.locked)return toast('Unlock this image and gallery before renaming');const value=prompt('Rename image (extension is preserved):',image.name.replace(/\\.[^.]+$/,''));if(value==null)return;if(!renameImage(image,value))return toast('Enter a valid image name');addEditEvent(book,'Image renamed',image.name);await persist(book);renderGallery();drawBook();return}
  const move=event.target.closest('[data-image-move]');if(move){const index=Number(move.dataset.imageMove),delta=Number(move.dataset.delta),target=index+delta,image=images[index];if(book.locked||!image||image.locked||target<0||target>=images.length||images[target].locked)return toast('Locked images and galleries cannot be reordered');[images[index],images[target]]=[images[target],images[index]];addEditEvent(book,'Image reordered',image.name+' · position '+(target+1));await persist(book);renderGallery();return}
  const lock=event.target.closest('[data-image-lock]');if(lock){const image=images[Number(lock.dataset.imageLock)];if(!image||book.locked)return toast('Unlock the gallery first');image.locked=!image.locked;addEditEvent(book,image.locked?'Image locked':'Image unlocked',image.name);await persist(book);renderGallery();return}
  const slideTarget=event.target.closest('[data-gallery-slide-index]');if(slideTarget){sliderIndex=Number(slideTarget.dataset.gallerySlideIndex);renderGallery();return}
  const copy=event.target.closest('[data-gallery-copy]');if(copy){await copyImage(images[Number(copy.dataset.galleryCopy)]);return}
  const card=event.target.closest('[data-gallery-image]');if(card){if(event.target.closest('details,textarea,summary,[data-gallery-copy],button,input'))return;await openImage(Number(card.dataset.galleryImage));return}
  if(event.target.closest('[data-gallery-prev]')){sliderIndex=Math.max(0,sliderIndex-1);renderGallery();return}
  if(event.target.closest('[data-gallery-next]')){sliderIndex=Math.min(images.length-1,sliderIndex+1);renderGallery();return}
 };
 host.onchange=async event=>{
  const selection=event.target.closest('[data-image-select]');if(selection){const image=images[Number(selection.dataset.imageSelect)];if(!image||image.locked)return;selection.checked?selectedImageIds.add(image.id):selectedImageIds.delete(image.id);const count=host.querySelector('[data-selected-count]');if(count)count.textContent=selectedImageIds.size+' selected';return}
  const field=event.target.closest('[data-image-note]');if(!field)return;
  const image=images[Number(field.dataset.imageNote)];if(!image||book.locked||image.locked)return;
  image.notes=field.value;await persist(book);toast('Image note saved');
 };
 if(!images.length){host.innerHTML+='<div class="empty">This gallery is empty. Add images or paste one from the clipboard.</div>';return}
 if(view==='grid'){
  host.innerHTML+='<div class="gallery-grid">'+images.map((image,index)=>'<article class="gallery-card '+(image.locked?'is-locked':'')+'" data-gallery-image="'+index+'" tabindex="0" role="button" aria-label="Open '+esc(image.name||'image')+'"><div class="gallery-card-image"><img loading="lazy" src="'+image.data+'" alt="'+esc(image.name||'Gallery image')+'"><span class="gallery-card-open">View image ↗</span></div><div class="gallery-card-caption"><b>'+esc(image.name||'Image '+(index+1))+'</b><span>'+(image.locked?'🔒':'')+'</span></div><div class="gallery-image-dates"><span>Added '+esc(dateTime(image.addedAt))+'</span><span>Opened '+esc(dateTime(image.lastOpenedAt))+' · '+formatBytes(imageSize(image))+'</span></div><details class="gallery-image-details" data-no-open><summary>Details & notes</summary><textarea data-image-note="'+index+'" rows="2" placeholder="Add a note…" '+(book.locked||image.locked?'disabled':'')+'>'+esc(image.notes||'')+'</textarea><div class="row"><button type="button" class="gallery-copy" data-gallery-copy="'+index+'">Copy image</button><span class="grow"></span><span class="tiny muted">'+(image.locked?'Image locked':'')+'</span></div></details></article>').join('')+'</div>';
 }else if(view==='compact'){
  const unlocked=images.filter(image=>!image.locked),selectedCount=images.filter(image=>selectedImageIds.has(image.id)).length;
  host.innerHTML+='<div class="gallery-compact-toolbar"><button type="button" data-gallery-select-all '+(book.locked?'disabled':'')+'>'+(selectedCount===unlocked.length&&unlocked.length?'Clear selection':'Select all')+'</button><button type="button" data-gallery-clear-selection '+(selectedCount?'':'disabled')+'>Clear</button><span class="tiny muted" data-selected-count>'+selectedCount+' selected</span><button type="button" data-gallery-bulk-rename '+(book.locked||!selectedCount?'disabled':'')+'>Bulk rename</button></div><div class="gallery-compact-list">'+images.map((image,index)=>'<div class="gallery-compact-row '+(image.locked?'is-locked':'')+'" data-gallery-image="'+index+'"><input type="checkbox" data-image-select="'+index+'" aria-label="Select '+esc(image.name)+'" '+(image.locked||book.locked?'disabled':'')+' '+(selectedImageIds.has(image.id)?'checked':'')+'><img class="gallery-compact-thumb" src="'+image.data+'" alt=""><span class="gallery-compact-name"><b>'+esc(image.name||'Image '+(index+1))+'</b><small>'+formatBytes(imageSize(image))+' · '+(image.locked?'Locked':'Unlocked')+'</small></span><button type="button" data-image-rename="'+index+'" '+(book.locked||image.locked?'disabled':'')+'>Rename</button><button type="button" data-image-lock="'+index+'" '+(book.locked?'disabled':'')+'>'+(image.locked?'Unlock':'Lock')+'</button><button type="button" data-image-move="'+index+'" data-delta="-1" '+(book.locked||image.locked||index===0||images[index-1]?.locked?'disabled':'')+' aria-label="Move up">↑</button><button type="button" data-image-move="'+index+'" data-delta="1" '+(book.locked||image.locked||index===images.length-1||images[index+1]?.locked?'disabled':'')+' aria-label="Move down">↓</button></div>').join('')+'</div>';
 }else{
  sliderIndex=Math.max(0,Math.min(images.length-1,sliderIndex));const image=images[sliderIndex],prev=images[sliderIndex-1],next=images[sliderIndex+1];
  host.innerHTML+='<div class="gallery-stage">'+(prev?'<button type="button" class="gallery-neighbor previous" data-gallery-prev><img src="'+prev.data+'" alt=""><span>‹</span></button>':'<span class="gallery-neighbor-spacer"></span>')+'<button type="button" class="gallery-slide-main" data-gallery-image="'+sliderIndex+'"><img src="'+image.data+'" alt="'+esc(image.name||'Gallery image')+'"><span class="gallery-slide-caption">'+esc(image.name||'Image')+' · '+(sliderIndex+1)+' of '+images.length+'</span></button>'+(next?'<button type="button" class="gallery-neighbor next" data-gallery-next><img src="'+next.data+'" alt=""><span>›</span></button>':'<span class="gallery-neighbor-spacer"></span>')+'</div><div class="gallery-filmstrip">'+images.map((item,i)=>'<button type="button" data-gallery-slide-index="'+i+'" class="'+(i===sliderIndex?'active':'')+'"><img src="'+item.data+'" alt=""><span>'+(i+1)+'</span></button>').join('')+'</div><div class="gallery-slide-position">'+(sliderIndex+1)+' of '+images.length+' images · '+esc(image.name||'')+'</div>';
 }
}
