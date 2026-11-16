import {state,setScreen,freshBook} from './state.js';import {put} from './db.js';import {$,toast,dataURL,uid} from './utils.js';import {drawBook,refresh} from './library.js';import {addEditEvent} from './history.js';import {confirmImagePreview} from './image-preview.js';
export function editChapter(index){if(state.book.locked)return toast('Unlock this book before editing');state.editIndex=index;const c=index==null?{title:'Chapter '+(state.book.chapters.length+1),text:'',images:[]}:state.book.chapters[index];$('editorHeading').textContent=index==null?'Add chapter':'Edit chapter';$('editChapterTitle').value=c.title||'';$('editChapterText').value=c.text||'';$('editorContext').textContent=state.book.title;setScreen('editor')}
export async function saveChapter(){
 const now=Date.now(),title=$('editChapterTitle').value.trim(),text=$('editChapterText').value,images=state.editIndex==null?(state.pendingImages||[]):(state.book.chapters[state.editIndex].images||[]);delete state.pendingImages;
 if(state.editIndex==null)state.book.chapters.push({title,text,images,createdAt:now,updatedAt:now,history:[]});
 else{const previous=state.book.chapters[state.editIndex],history=Array.isArray(previous.history)?previous.history:[];history.push({title:previous.title||'',text:previous.text||'',editedAt:now});state.book.chapters[state.editIndex]={...previous,title,text,images,createdAt:previous.createdAt??previous.addedAt,updatedAt:now,history}}
 state.book.updated=now;addEditEvent(state.book,state.editIndex==null?'Chapter added':'Chapter edited',title||'Untitled chapter');await put(state.book);await refresh();drawBook();setScreen('book');toast('Chapter saved');
}
export async function deleteChapter(){if(state.editIndex==null||state.book.locked||!confirm('Delete this chapter?'))return;const removed=state.book.chapters[state.editIndex];state.book.chapters.splice(state.editIndex,1);addEditEvent(state.book,'Chapter deleted',removed?.title||'Untitled chapter');await put(state.book);await refresh();drawBook();setScreen('book')}
export async function insertImage(file){if(!file)return;if(state.book?.locked)return toast('Unlock editing first');if(!(await confirmImagePreview(file,{title:'Preview chapter image',confirmLabel:'Insert image'})))return;const data=await dataURL(file),id=uid(),ta=$('editChapterText'),pos=ta.selectionStart;ta.setRangeText('\n[IMAGE:'+id+']\n',pos,ta.selectionEnd,'end');const image={id,data,after:ta.value.slice(0,pos).split(/\n\s*\n/).length};if(state.editIndex==null){state.pendingImages=state.pendingImages||[];state.pendingImages.push(image)}else{state.book.chapters[state.editIndex].images=state.book.chapters[state.editIndex].images||[];state.book.chapters[state.editIndex].images.push(image)}toast('Image inserted at cursor')}
export async function importTextBook(fileList){
 const files=[...fileList].filter(f=>/\.txt$/i.test(f.name));
 if(!files.length)return toast('No .txt files found');
 const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
 files.sort((a,b)=>collator.compare(a.webkitRelativePath||a.name,b.webkitRelativePath||b.name));
 const imported=[];
 for(const file of files){
  const text=(await file.text()).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!text)continue;
  const relative=file.webkitRelativePath||file.name;
  const base=relative.split('/').pop().replace(/\.txt$/i,'');
  const now=Date.now();imported.push({title:base||'Untitled chapter',text,images:[],createdAt:now,updatedAt:now,history:[]});
 }
 if(!imported.length)return toast('The selected text files are empty');
 const firstPath=files[0].webkitRelativePath||'';
 const folderName=firstPath.includes('/')?firstPath.split('/')[0]:'';
 const novelTitle=folderName||imported[0].title.replace(/\s*[-_]?(chapter|ch|part)\s*\d+.*$/i,'').trim()||imported[0].title;
 const book=freshBook('manual',novelTitle);
 book.chapters=imported;
 book.updated=Date.now();
 await put(book);await refresh();state.book=book;drawBook();setScreen('book');
 toast(imported.length+' TXT chapter'+(imported.length===1?'':'s')+' imported');
}

export async function importTextChapters(fileList){
 if(!state.book)return toast('Open a book first');
 if(state.book.locked)return toast('Unlock this book before adding chapters');
 const files=[...fileList].filter(f=>/\.txt$/i.test(f.name));
 if(!files.length)return toast('No .txt files selected');
 const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
 files.sort((a,b)=>collator.compare(a.webkitRelativePath||a.name,b.webkitRelativePath||b.name));
 const imported=[];
 for(const file of files){
  const text=(await file.text()).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!text)continue;
  const now=Date.now();imported.push({title:file.name.replace(/\.txt$/i,''),text,images:[],createdAt:now,updatedAt:now,history:[]});
 }
 if(!imported.length)return toast('The selected TXT files are empty');
 state.book.chapters.push(...imported);
 state.book.updated=Date.now();addEditEvent(state.book,'Chapters imported',imported.length+' TXT chapters');
 await put(state.book);await refresh();drawBook();
 toast(imported.length+' TXT chapter'+(imported.length===1?'':'s')+' added');
}

export async function pasteEditorImage(){
 if(state.book?.locked)return toast('Unlock editing first');
 if(!navigator.clipboard?.read)return toast('Clipboard image access is unavailable. Use the system paste shortcut in the chapter text box instead.');
 try{
  const items=await navigator.clipboard.read();
  for(const item of items){const type=item.types.find(value=>value.startsWith('image/'));if(!type)continue;const blob=await item.getType(type);const file=new File([blob],'pasted-image.'+(type.split('/')[1]||'png'),{type});await insertImage(file);return}
  toast('No image found in the clipboard');
 }catch(error){toast('Could not read clipboard image. Check browser clipboard permission.')}
}
